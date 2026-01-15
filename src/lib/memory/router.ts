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

// Thresholds - adaptive based on context
const BASE_CONFIDENCE_THRESHOLD = 0.55;
const CONFLICT_MARGIN = 0.12;
const HIGH_CONFIDENCE_BOOST = 0.85;

// Context weight factors for embedding blending
const CONTEXT_WEIGHTS = {
  recency: [1.0, 0.8, 0.6, 0.4, 0.2], // Most recent gets highest weight
  layerBoost: {
    IMM: 1.2,  // Identity should be weighted higher
    EMM: 1.0,
    KMM: 1.1,  // Skills slightly boosted
  },
};

// Enhanced seed data with more diverse examples
const SEED_DATA: { text: string; label: Layer; weight?: number }[] = [
  // Identity (IMM) - permanent facts about the user
  { text: "My name is John", label: "IMM", weight: 1.5 },
  { text: "I am vegetarian", label: "IMM", weight: 1.5 },
  { text: "I'm allergic to nuts", label: "IMM", weight: 1.5 },
  { text: "I don't eat meat", label: "IMM" },
  { text: "My religion is Buddhism", label: "IMM" },
  { text: "I prefer dark mode", label: "IMM" },
  { text: "Call me Alex", label: "IMM", weight: 1.5 },
  { text: "I am 25 years old", label: "IMM" },
  { text: "I'm a software engineer", label: "IMM" },
  { text: "I live in New York", label: "IMM" },
  { text: "My birthday is March 15", label: "IMM" },
  { text: "I have two kids", label: "IMM" },
  { text: "I'm from California", label: "IMM" },
  { text: "My favorite color is blue", label: "IMM" },
  { text: "I'm married", label: "IMM" },
  { text: "I have a dog named Max", label: "IMM" },
  { text: "I don't drink alcohol", label: "IMM" },
  { text: "I'm lactose intolerant", label: "IMM" },
  
  // Experience (EMM) - temporal events and feelings
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
  { text: "I'm tired from last night", label: "EMM" },
  { text: "Had an argument with my friend", label: "EMM" },
  { text: "My car broke down yesterday", label: "EMM" },
  { text: "I'm nervous about the interview", label: "EMM" },
  { text: "Celebrated my promotion today", label: "EMM" },
  { text: "Feeling overwhelmed with deadlines", label: "EMM" },
  { text: "Had a wonderful dinner last night", label: "EMM" },
  { text: "I'm frustrated with this bug", label: "EMM" },
  
  // Knowledge (KMM) - skills, abilities, learned information
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
  { text: "I'm certified in AWS", label: "KMM" },
  { text: "I can play the guitar", label: "KMM" },
  { text: "I studied economics in college", label: "KMM" },
  { text: "I'm familiar with Docker", label: "KMM" },
  { text: "I learned Spanish in high school", label: "KMM" },
  { text: "I'm experienced with Agile", label: "KMM" },
  { text: "I can cook Italian food", label: "KMM" },
  { text: "I have photography skills", label: "KMM" },
];

// Negative examples to help distinguish layers
const NEGATIVE_EXAMPLES: { text: string; notLabel: Layer }[] = [
  { text: "What's your name?", notLabel: "IMM" },  // Question, not identity
  { text: "How do you code?", notLabel: "KMM" },   // Question, not knowledge
  { text: "What happened today?", notLabel: "EMM" }, // Question, not experience
  { text: "Tell me about yourself", notLabel: "IMM" },
  { text: "Can you help me?", notLabel: "KMM" },
];

// Router statistics for adaptive learning
interface RouterStats {
  totalRoutes: number;
  corrections: number;
  layerHits: Record<Layer, number>;
  avgConfidence: number;
  lastTrainingTime: string;
}

export class ProductionRouter {
  private classifier: LinearClassifier | null = null;
  private cache: LRUCache;
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;
  private stats: RouterStats = {
    totalRoutes: 0,
    corrections: 0,
    layerHits: { IMM: 0, EMM: 0, KMM: 0 },
    avgConfidence: 0,
    lastTrainingTime: "",
  };
  private recentDecisions: { layer: Layer; confidence: number }[] = [];

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
      // Initialize and train on seed data with weighted learning
      this.classifier = new LinearClassifier(dim);
      await this.trainOnSeedData();
      
      // Save initial weights
      await this.persist();
    }

    this.stats.lastTrainingTime = new Date().toISOString();
    this.isInitialized = true;
  }

  // Train on seed data with optional weighting
  private async trainOnSeedData(): Promise<void> {
    if (!this.classifier) return;
    
    // Train on positive examples
    for (const example of SEED_DATA) {
      const emb = await generateEmbedding(example.text);
      const weight = example.weight || 1.0;
      
      // Apply weight by training multiple times for important examples
      const iterations = Math.ceil(weight);
      for (let i = 0; i < iterations; i++) {
        this.classifier.train(emb, example.label, 0.05 * weight);
      }
    }
    
    // Train on negative examples to sharpen boundaries
    for (const neg of NEGATIVE_EXAMPLES) {
      const emb = await generateEmbedding(neg.text);
      const otherLayers = (["IMM", "EMM", "KMM"] as Layer[]).filter(l => l !== neg.notLabel);
      // Boost the other layers slightly for this example
      for (const layer of otherLayers) {
        this.classifier.train(emb, layer, 0.02);
      }
    }
  }

  // Main routing function with enhanced logic
  async route(text: string, context: string[] = []): Promise<RoutingResult> {
    // 1. Hard rules first (always apply)
    const ruleResult = applyHardRules(text);
    if (ruleResult) {
      this.updateStats(ruleResult.decision as Layer, 1.0);
      return ruleResult;
    }

    // 2. Quick text analysis for obvious cases
    const quickResult = this.quickTextAnalysis(text);
    if (quickResult) {
      this.updateStats(quickResult.decision as Layer, quickResult.confidence);
      return quickResult;
    }

    // 3. Check cache
    const cacheKey = this.generateCacheKey(text, context);
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    // 4. Ensure initialized
    await this.init();

    if (!this.classifier) {
      return this.fallbackResult("Classifier not ready");
    }

    // 5. ML routing with enhanced embedding
    const embedding = await this.embedWithContext(text, context);
    const probs = this.classifier.predict(embedding);

    // Apply layer-specific boosts based on text signals
    const adjustedProbs = this.applyLayerBoosts(text, probs);

    // Sort by probability
    const sorted = (Object.entries(adjustedProbs) as [Layer, number][])
      .sort((a, b) => b[1] - a[1]);
    
    const [topLayer, topConf] = sorted[0];
    const secondConf = sorted[1][1];

    // Adaptive threshold based on recent performance
    const threshold = this.getAdaptiveThreshold();
    
    let decision: Decision;
    let reasoning: string;

    if (topConf < threshold) {
      // Low confidence - check if we can infer from context
      const contextHint = this.inferFromContext(context);
      if (contextHint && adjustedProbs[contextHint] > threshold * 0.8) {
        decision = contextHint;
        reasoning = `Context-informed decision: ${contextHint}`;
      } else {
        decision = "ASK";
        reasoning = `Low confidence (${(topConf * 100).toFixed(0)}%), threshold: ${(threshold * 100).toFixed(0)}%`;
      }
    } else if (topConf - secondConf < CONFLICT_MARGIN) {
      // Close competition - use tiebreaker logic
      decision = this.resolveTie(topLayer, sorted[1][0] as Layer, text, context);
      reasoning = `Resolved tie between ${sorted[0][0]} and ${sorted[1][0]}`;
    } else if (topConf > HIGH_CONFIDENCE_BOOST) {
      decision = topLayer;
      reasoning = `High confidence ${topLayer}: ${(topConf * 100).toFixed(0)}%`;
    } else {
      decision = topLayer;
      reasoning = `ML decision: ${topLayer} (${(topConf * 100).toFixed(0)}%)`;
    }

    const result: RoutingResult = {
      decision,
      confidence: topConf,
      probabilities: adjustedProbs,
      source: "ML",
      reasoning,
    };

    // Update stats and cache
    if (decision === "IMM" || decision === "EMM" || decision === "KMM") {
      this.updateStats(decision as Layer, topConf);
    }
    this.cache.set(cacheKey, result);

    return result;
  }

  // Quick text analysis for obvious patterns without ML
  private quickTextAnalysis(text: string): RoutingResult | null {
    const t = text.toLowerCase().trim();
    
    // Temporal markers strongly suggest EMM
    const temporalPatterns = /\b(today|yesterday|tomorrow|this morning|last night|just now|earlier|recently|this week)\b/i;
    if (temporalPatterns.test(t)) {
      const hasIdentitySignal = /\b(my name|i am a|i'm a|call me|i don't eat)\b/i.test(t);
      if (!hasIdentitySignal) {
        return {
          decision: "EMM",
          confidence: 0.75,
          probabilities: { IMM: 0.1, EMM: 0.75, KMM: 0.15 },
          source: "ML",
          reasoning: "Temporal marker detected",
        };
      }
    }

    // Emotional markers suggest EMM
    const emotionalPatterns = /\b(feeling|feel|felt|happy|sad|angry|excited|frustrated|stressed|tired|anxious)\b/i;
    if (emotionalPatterns.test(t) && !t.startsWith("i am a") && !t.startsWith("i'm a")) {
      return {
        decision: "EMM",
        confidence: 0.72,
        probabilities: { IMM: 0.12, EMM: 0.72, KMM: 0.16 },
        source: "ML",
        reasoning: "Emotional content detected",
      };
    }

    // Skill/ability markers suggest KMM
    const skillPatterns = /\b(can|know how to|learned|studied|experienced with|familiar with|proficient in|certified)\b/i;
    if (skillPatterns.test(t) && /\b(to|in|with|about)\b/i.test(t)) {
      return {
        decision: "KMM",
        confidence: 0.73,
        probabilities: { IMM: 0.12, EMM: 0.15, KMM: 0.73 },
        source: "ML",
        reasoning: "Skill/ability pattern detected",
      };
    }

    return null;
  }

  // Generate a smarter cache key
  private generateCacheKey(text: string, context: string[]): string {
    const textHash = text.toLowerCase().trim().substring(0, 100);
    const contextHash = context.slice(-2).join("|").substring(0, 50);
    return `${textHash}|${contextHash}`;
  }

  // Fallback result when classifier isn't ready
  private fallbackResult(reason: string): RoutingResult {
    return {
      decision: "EMM",
      confidence: 0.5,
      probabilities: { IMM: 0.25, EMM: 0.5, KMM: 0.25 },
      source: "ML",
      reasoning: reason,
    };
  }

  // Apply layer-specific boosts based on text signals
  private applyLayerBoosts(text: string, probs: Record<Layer, number>): Record<Layer, number> {
    const adjusted = { ...probs };
    const t = text.toLowerCase();

    // Boost IMM for possessive patterns
    if (/\b(my|i am|i'm|i have)\b/i.test(t) && !/\b(today|yesterday|feeling)\b/i.test(t)) {
      adjusted.IMM *= CONTEXT_WEIGHTS.layerBoost.IMM;
    }

    // Boost EMM for temporal content
    if (/\b(today|yesterday|last|this|just|recently)\b/i.test(t)) {
      adjusted.EMM *= 1.15;
    }

    // Boost KMM for skill content
    if (/\b(know|learn|skill|experience|can do|able to)\b/i.test(t)) {
      adjusted.KMM *= CONTEXT_WEIGHTS.layerBoost.KMM;
    }

    // Normalize
    const sum = adjusted.IMM + adjusted.EMM + adjusted.KMM;
    adjusted.IMM /= sum;
    adjusted.EMM /= sum;
    adjusted.KMM /= sum;

    return adjusted;
  }

  // Get adaptive threshold based on recent performance
  private getAdaptiveThreshold(): number {
    if (this.recentDecisions.length < 5) {
      return BASE_CONFIDENCE_THRESHOLD;
    }

    const recentAvg = this.recentDecisions
      .slice(-10)
      .reduce((sum, d) => sum + d.confidence, 0) / Math.min(10, this.recentDecisions.length);

    // If recent decisions are high confidence, raise threshold slightly
    if (recentAvg > 0.8) {
      return Math.min(0.65, BASE_CONFIDENCE_THRESHOLD + 0.05);
    }
    
    // If recent decisions are low confidence, lower threshold slightly
    if (recentAvg < 0.6) {
      return Math.max(0.45, BASE_CONFIDENCE_THRESHOLD - 0.05);
    }

    return BASE_CONFIDENCE_THRESHOLD;
  }

  // Infer layer from conversation context
  private inferFromContext(context: string[]): Layer | null {
    if (context.length === 0) return null;

    const recentText = context.slice(-3).join(" ").toLowerCase();

    // If recent context is about identity, lean towards IMM
    if (/\b(who are you|tell me about yourself|your name|introduce)\b/.test(recentText)) {
      return "IMM";
    }

    // If recent context is about events/feelings, lean towards EMM
    if (/\b(how was|what happened|how are you|what did you do)\b/.test(recentText)) {
      return "EMM";
    }

    // If recent context is about skills/knowledge, lean towards KMM
    if (/\b(what do you know|can you|skills|experience|learn)\b/.test(recentText)) {
      return "KMM";
    }

    return null;
  }

  // Resolve ties between two layers
  private resolveTie(layer1: Layer, layer2: Layer, text: string, context: string[]): Layer {
    const t = text.toLowerCase();

    // IMM vs EMM: prefer IMM for persistent facts
    if ((layer1 === "IMM" && layer2 === "EMM") || (layer1 === "EMM" && layer2 === "IMM")) {
      // Temporal words = EMM, persistent facts = IMM
      if (/\b(today|yesterday|now|this week|recently)\b/.test(t)) {
        return "EMM";
      }
      if (/\b(always|never|am a|my|i have)\b/.test(t)) {
        return "IMM";
      }
      return "IMM"; // Default to IMM for safety
    }

    // EMM vs KMM: prefer KMM for skills
    if ((layer1 === "EMM" && layer2 === "KMM") || (layer1 === "KMM" && layer2 === "EMM")) {
      if (/\b(can|know|learned|skill|experience)\b/.test(t)) {
        return "KMM";
      }
      return "EMM";
    }

    // IMM vs KMM: prefer IMM for identity facts
    if ((layer1 === "IMM" && layer2 === "KMM") || (layer1 === "KMM" && layer2 === "IMM")) {
      if (/\b(i am a|i'm a|my name|call me)\b/.test(t)) {
        return "IMM";
      }
      if (/\b(know how|can do|skill|learned)\b/.test(t)) {
        return "KMM";
      }
      return "IMM";
    }

    return layer1;
  }

  // Update internal stats
  private updateStats(layer: Layer, confidence: number): void {
    this.stats.totalRoutes++;
    this.stats.layerHits[layer]++;
    
    // Rolling average for confidence
    this.stats.avgConfidence = 
      (this.stats.avgConfidence * (this.stats.totalRoutes - 1) + confidence) / this.stats.totalRoutes;
    
    this.recentDecisions.push({ layer, confidence });
    if (this.recentDecisions.length > 50) {
      this.recentDecisions.shift();
    }
  }

  // Learn from user correction with boosted learning
  async learn(text: string, context: string[], correct: Layer): Promise<void> {
    await this.init();

    if (!this.classifier) return;

    const emb = await this.embedWithContext(text, context);
    
    // Train with higher learning rate for corrections (user feedback is valuable)
    this.classifier.train(emb, correct, 0.1);
    
    // Also train without context to generalize
    const rawEmb = await generateEmbedding(text);
    this.classifier.train(rawEmb, correct, 0.08);

    // Save correction for future retraining
    const entry: CorrectionEntry = {
      text,
      context,
      correct,
      timestamp: new Date().toISOString(),
    };
    await addCorrection(entry);

    // Update stats
    this.stats.corrections++;

    // Persist updated weights
    await this.persist();

    // Invalidate cache
    this.cache.clear();
  }

  // Retrain from all corrections with progressive learning
  async retrainFromHistory(): Promise<void> {
    await this.init();

    if (!this.classifier) return;

    const corrections = await loadCorrections();

    // Reset classifier
    const dim = this.classifier.getDimension();
    this.classifier = new LinearClassifier(dim);

    // Train on seed data first
    await this.trainOnSeedData();

    // Then train on corrections with progressive weighting (newer = more weight)
    const sortedCorrections = corrections.sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    
    for (let i = 0; i < sortedCorrections.length; i++) {
      const correction = sortedCorrections[i];
      const emb = await this.embedWithContext(correction.text, correction.context);
      
      // Progressive weight: newer corrections get higher learning rate
      const progressWeight = 0.05 + (i / sortedCorrections.length) * 0.1;
      this.classifier.train(emb, correction.correct, progressWeight);
    }

    this.stats.lastTrainingTime = new Date().toISOString();
    await this.persist();
    this.cache.clear();
  }

  // Generate embedding with weighted context blending
  private async embedWithContext(text: string, context: string[]): Promise<number[]> {
    const textEmb = await generateEmbedding(text);

    if (!context.length) return textEmb;

    // Get context embeddings with recency weighting
    const contextMessages = context.slice(-5);
    const weights = CONTEXT_WEIGHTS.recency.slice(0, contextMessages.length);
    
    let blendedContext: number[] | null = null;
    let totalWeight = 0;

    for (let i = 0; i < contextMessages.length; i++) {
      const ctxEmb = await generateEmbedding(contextMessages[contextMessages.length - 1 - i]);
      const weight = weights[i];
      totalWeight += weight;

      if (!blendedContext) {
        blendedContext = ctxEmb.map(v => v * weight);
      } else {
        for (let j = 0; j < ctxEmb.length; j++) {
          blendedContext[j] += ctxEmb[j] * weight;
        }
      }
    }

    if (!blendedContext) return textEmb;

    // Normalize blended context
    blendedContext = blendedContext.map(v => v / totalWeight);

    // Blend text with context (70% text, 30% context)
    return textEmb.map((v, i) => v * 0.7 + blendedContext![i] * 0.3);
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

  // Get router statistics
  getStats(): RouterStats {
    return { ...this.stats };
  }

  // Debug: get recent decisions
  getRecentDecisions(): { layer: Layer; confidence: number }[] {
    return [...this.recentDecisions];
  }
}

// Singleton instance
export const router = new ProductionRouter();
