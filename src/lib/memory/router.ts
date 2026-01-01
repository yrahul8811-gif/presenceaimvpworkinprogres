// Production Router - Hard rules + ML classification with learning

import type { Layer, Decision, RoutingResult, CorrectionEntry } from "./types";
import { LinearClassifier } from "./classifier";
import { applyHardRules } from "./hardRules";
import { LRUCache } from "./cache";
import { 
  generateEmbedding, 
  initEmbeddings, 
  getEmbeddingStatus,
  getEmbeddingDimension 
} from "./embeddings";
import { 
  saveRouterWeights, 
  loadRouterWeights, 
  addCorrection, 
  loadCorrections 
} from "./persistence";

// Thresholds
const CONFIDENCE_THRESHOLD = 0.6;
const CONFLICT_MARGIN = 0.15;

// Seed data for initial training
const SEED_DATA: { text: string; label: Layer }[] = [
  // Identity (IMM)
  { text: "My name is John", label: "IMM" },
  { text: "I am vegetarian", label: "IMM" },
  { text: "I'm allergic to nuts", label: "IMM" },
  { text: "I don't eat meat", label: "IMM" },
  { text: "My religion is Buddhism", label: "IMM" },
  { text: "I prefer dark mode", label: "IMM" },
  { text: "Call me Alex", label: "IMM" },
  { text: "I am 25 years old", label: "IMM" },
  { text: "I'm a software engineer", label: "IMM" },
  { text: "I live in New York", label: "IMM" },
  
  // Experience (EMM)
  { text: "I had a great meeting today", label: "EMM" },
  { text: "We discussed the project timeline", label: "EMM" },
  { text: "I'm feeling stressed about work", label: "EMM" },
  { text: "My mom called me yesterday", label: "EMM" },
  { text: "I went to the gym this morning", label: "EMM" },
  { text: "The weather is nice today", label: "EMM" },
  { text: "I had coffee with Sarah", label: "EMM" },
  { text: "My boss approved my vacation", label: "EMM" },
  { text: "I'm excited about the weekend", label: "EMM" },
  { text: "Just finished a tough project", label: "EMM" },
  
  // Knowledge (KMM)
  { text: "I know how to code in Python", label: "KMM" },
  { text: "I learned React last year", label: "KMM" },
  { text: "I understand machine learning basics", label: "KMM" },
  { text: "I can speak three languages", label: "KMM" },
  { text: "I'm skilled in data analysis", label: "KMM" },
  { text: "I work with databases", label: "KMM" },
  { text: "I have experience in project management", label: "KMM" },
  { text: "I specialize in frontend development", label: "KMM" },
  { text: "I'm good at problem solving", label: "KMM" },
  { text: "I know TypeScript well", label: "KMM" },
];

export class ProductionRouter {
  private classifier: LinearClassifier | null = null;
  private cache: LRUCache;
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.cache = new LRUCache(1000, 30);
  }

  // Initialize router with embeddings and classifier
  async init(): Promise<void> {
    if (this.isInitialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this._doInit();
    return this.initPromise;
  }

  private async _doInit(): Promise<void> {
    // Ensure embeddings are ready
    await initEmbeddings();
    
    // Get embedding dimension
    const dim = await getEmbeddingDimension();
    
    // Try to load saved weights
    const savedWeights = await loadRouterWeights();
    
    if (savedWeights) {
      this.classifier = new LinearClassifier(dim, savedWeights);
    } else {
      // Initialize and train on seed data
      this.classifier = new LinearClassifier(dim);
      
      for (const example of SEED_DATA) {
        const emb = await generateEmbedding(example.text);
        this.classifier.train(emb, example.label);
      }
      
      // Save initial weights
      await this.persist();
    }

    this.isInitialized = true;
  }

  // Main routing function
  async route(text: string, context: string[] = []): Promise<RoutingResult> {
    // 1. Hard rules first (always apply)
    const ruleResult = applyHardRules(text);
    if (ruleResult) return ruleResult;

    // 2. Check cache
    const cacheKey = text + "|" + context.slice(-3).join("|");
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    // 3. Ensure initialized
    await this.init();

    if (!this.classifier) {
      // Fallback if classifier not ready
      return {
        decision: "EMM",
        confidence: 0.5,
        probabilities: { IMM: 0.2, EMM: 0.5, KMM: 0.3 },
        source: "ML",
        reasoning: "Classifier not ready, defaulting to EMM",
      };
    }

    // 4. ML routing
    const embedding = await this.embed(text, context);
    const probs = this.classifier.predict(embedding);

    // Sort by probability
    const sorted = (Object.entries(probs) as [Layer, number][])
      .sort((a, b) => b[1] - a[1]);
    
    const [topLayer, topConf] = sorted[0];
    const secondConf = sorted[1][1];

    let decision: Decision;
    let reasoning: string;

    if (topConf < CONFIDENCE_THRESHOLD) {
      decision = "ASK";
      reasoning = `Low confidence (${(topConf * 100).toFixed(0)}%)`;
    } else if (topConf - secondConf < CONFLICT_MARGIN) {
      decision = "CONFLICT";
      reasoning = `Competing intents: ${sorted[0][0]} vs ${sorted[1][0]}`;
    } else {
      decision = topLayer;
      reasoning = `ML dominant intent: ${topLayer}`;
    }

    const result: RoutingResult = {
      decision,
      confidence: topConf,
      probabilities: probs,
      source: "ML",
      reasoning,
    };

    // Cache result
    this.cache.set(cacheKey, result);

    return result;
  }

  // Learn from user correction
  async learn(text: string, context: string[], correct: Layer): Promise<void> {
    await this.init();

    if (!this.classifier) return;

    const emb = await this.embed(text, context);
    this.classifier.train(emb, correct);

    // Save correction for future retraining
    const entry: CorrectionEntry = {
      text,
      context,
      correct,
      timestamp: new Date().toISOString(),
    };
    await addCorrection(entry);

    // Persist updated weights
    await this.persist();

    // Invalidate cache
    this.cache.clear();
  }

  // Retrain from all corrections
  async retrainFromHistory(): Promise<void> {
    await this.init();

    if (!this.classifier) return;

    const corrections = await loadCorrections();
    if (corrections.length === 0) return;

    // Reset classifier
    const dim = this.classifier.getDimension();
    this.classifier = new LinearClassifier(dim);

    // Train on seed data first
    for (const example of SEED_DATA) {
      const emb = await generateEmbedding(example.text);
      this.classifier.train(emb, example.label);
    }

    // Then train on corrections
    for (const correction of corrections) {
      const emb = await this.embed(correction.text, correction.context);
      this.classifier.train(emb, correction.correct);
    }

    await this.persist();
    this.cache.clear();
  }

  // Generate embedding with optional context blending
  private async embed(text: string, context: string[]): Promise<number[]> {
    const textEmb = await generateEmbedding(text);

    if (!context.length) return textEmb;

    // Blend with context (last 5 messages)
    const ctxText = context.slice(-5).join(" ");
    const ctxEmb = await generateEmbedding(ctxText);

    // Average the embeddings
    return textEmb.map((v, i) => (v + ctxEmb[i]) / 2);
  }

  // Persist weights to IndexedDB
  private async persist(): Promise<void> {
    if (this.classifier) {
      await saveRouterWeights(this.classifier.weights);
    }
  }

  // Check if ready
  isReady(): boolean {
    return this.isInitialized && getEmbeddingStatus() === "ready";
  }

  // Get status
  getStatus(): string {
    if (!this.isInitialized) return "not_initialized";
    if (getEmbeddingStatus() !== "ready") return "loading_embeddings";
    return "ready";
  }
}

// Singleton instance
export const router = new ProductionRouter();
