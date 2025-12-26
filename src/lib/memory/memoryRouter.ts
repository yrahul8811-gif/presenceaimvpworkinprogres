// Memory Router - Core routing logic for the three-layer memory system
// Retrieval order: Identity (IMM) → Experience (EMM) → Knowledge (KMM)

import type { 
  MemoryResult, 
  MemoryWriteRequest, 
  IdentityFact, 
  ExperienceEntry, 
  KnowledgeEntry,
  ContextType,
  MemoryConflict 
} from "./types";
import { 
  getAllIdentityFacts, 
  searchIdentityFacts, 
  addIdentityFact,
  getIdentityByKey,
  updateIdentityConfidence
} from "./identityStore";
import { 
  searchExperiencesSemantic, 
  getRecentExperiences,
  addExperience,
  getExperiencesByContext
} from "./experienceStore";
import { 
  searchKnowledgeSemantic,
  addKnowledge,
  reinforceKnowledge
} from "./knowledgeStore";
import { detectMemoryIntent, calculateImportance } from "./contextDetector";
import { generateEmbedding, getEmbeddingStatus, initEmbeddings } from "../embeddings";

const CONFIDENCE_THRESHOLD = 0.5;
const MIN_CONFIRMATIONS_FOR_IDENTITY = 1; // Can be increased for stricter identity writes

export interface RetrievalOptions {
  contextFilter?: ContextType;
  includeIdentity?: boolean;
  includeExperience?: boolean;
  includeKnowledge?: boolean;
  topK?: number;
  semanticThreshold?: number;
}

export interface WriteResult {
  success: boolean;
  layer: "identity" | "experience" | "knowledge";
  conflict?: MemoryConflict;
  message?: string;
}

// Main retrieval pipeline - follows strict precedence
export const retrieveMemories = async (
  query: string,
  options: RetrievalOptions = {}
): Promise<MemoryResult[]> => {
  const {
    contextFilter,
    includeIdentity = true,
    includeExperience = true,
    includeKnowledge = true,
    topK = 5,
    semanticThreshold = 0.4,
  } = options;

  const results: MemoryResult[] = [];
  const detection = detectMemoryIntent(query);

  // Step 1: Query Identity Memory first (exact, highest priority)
  if (includeIdentity) {
    const identityResults = await searchIdentityFacts(query);
    for (const fact of identityResults.slice(0, 3)) {
      if (fact.confidence >= CONFIDENCE_THRESHOLD) {
        results.push({
          layer: "identity",
          content: `${fact.key}: ${fact.value}`,
          confidence: fact.confidence,
          timestamp: fact.lastConfirmed,
          metadata: { 
            category: fact.category,
            confirmationCount: fact.confirmationCount 
          },
        });
      }
    }
  }

  // Step 2: Query Experience Memory (filter by context first, then semantic)
  if (includeExperience && getEmbeddingStatus() === "ready") {
    try {
      const queryEmbedding = await generateEmbedding(query);
      
      // First, try context-filtered search
      const contextExperiences = await searchExperiencesSemantic(
        queryEmbedding,
        topK,
        semanticThreshold,
        contextFilter || detection.context !== "general" ? detection.context : undefined
      );
      
      for (const exp of contextExperiences) {
        results.push({
          layer: "experience",
          content: exp.content,
          confidence: exp.importance,
          similarity: exp.similarity,
          timestamp: exp.timestamp,
          metadata: { 
            context: exp.context, 
            role: exp.role 
          },
        });
      }
      
      // If not enough results, search without context filter
      if (results.filter(r => r.layer === "experience").length < topK / 2) {
        const generalExperiences = await searchExperiencesSemantic(
          queryEmbedding,
          topK,
          semanticThreshold
        );
        
        const existingIds = new Set(results.map(r => r.content));
        for (const exp of generalExperiences) {
          if (!existingIds.has(exp.content)) {
            results.push({
              layer: "experience",
              content: exp.content,
              confidence: exp.importance,
              similarity: exp.similarity,
              timestamp: exp.timestamp,
              metadata: { context: exp.context, role: exp.role },
            });
          }
        }
      }
    } catch (error) {
      console.warn("Experience search failed:", error);
    }
  }

  // Step 3: Query Knowledge Memory (semantic search)
  if (includeKnowledge && getEmbeddingStatus() === "ready") {
    try {
      const queryEmbedding = await generateEmbedding(query);
      const knowledgeResults = await searchKnowledgeSemantic(
        queryEmbedding,
        topK,
        semanticThreshold * 0.8 // Lower threshold for knowledge
      );
      
      for (const know of knowledgeResults) {
        results.push({
          layer: "knowledge",
          content: know.content,
          confidence: know.confidence,
          similarity: know.similarity,
          timestamp: know.timestamp,
          metadata: { 
            category: know.category,
            reinforcementCount: know.reinforcementCount 
          },
        });
      }
    } catch (error) {
      console.warn("Knowledge search failed:", error);
    }
  }

  // Apply precedence rules: sort by layer priority, then by confidence/similarity
  return results.sort((a, b) => {
    const layerPriority = { identity: 3, experience: 2, knowledge: 1 };
    const layerDiff = layerPriority[b.layer] - layerPriority[a.layer];
    if (layerDiff !== 0) return layerDiff;
    
    // Within same layer, sort by confidence/similarity
    const aScore = a.similarity || a.confidence;
    const bScore = b.similarity || b.confidence;
    return bScore - aScore;
  }).slice(0, topK);
};

// Write memory with automatic layer routing
export const writeMemory = async (
  request: MemoryWriteRequest
): Promise<WriteResult> => {
  const { content, role, context = "general", forceLayer } = request;
  const detection = detectMemoryIntent(content);
  
  // Determine target layer
  const targetLayer = forceLayer || detection.suggestedLayer;
  
  // Ensure embeddings are ready for experience/knowledge
  if ((targetLayer === "experience" || targetLayer === "knowledge") && getEmbeddingStatus() !== "ready") {
    try {
      await initEmbeddings();
    } catch (error) {
      console.warn("Could not initialize embeddings, falling back to experience without vector");
    }
  }
  
  switch (targetLayer) {
    case "identity":
      return await writeIdentity(content, detection);
    case "experience":
      return await writeExperience(content, role, context || detection.context);
    case "knowledge":
      return await writeKnowledge(content, detection);
    default:
      return await writeExperience(content, role, context || detection.context);
  }
};

// Write to Identity Memory (strict rules)
const writeIdentity = async (
  content: string,
  detection: ReturnType<typeof detectMemoryIntent>
): Promise<WriteResult> => {
  if (!detection.extractedKey || !detection.extractedValue) {
    // Can't extract identity fact, store as experience instead
    return {
      success: false,
      layer: "identity",
      message: "Could not extract identity fact, consider storing as experience",
    };
  }
  
  // Check for existing fact with same key
  const existing = await getIdentityByKey(detection.extractedKey);
  
  if (existing) {
    // Check for conflict
    if (existing.value.toLowerCase() !== detection.extractedValue.toLowerCase()) {
      // Conflict detected!
      return {
        success: false,
        layer: "identity",
        conflict: {
          existingFact: existing,
          newValue: detection.extractedValue,
          suggestedAction: existing.confidence > 0.8 ? "ask_user" : "update",
        },
        message: `Conflict: existing ${detection.extractedKey}="${existing.value}" vs new "${detection.extractedValue}"`,
      };
    } else {
      // Same value, reinforce confidence
      await updateIdentityConfidence(existing.id, existing.confidence + 0.1);
      return {
        success: true,
        layer: "identity",
        message: "Identity fact reinforced",
      };
    }
  }
  
  // New identity fact
  const newFact: IdentityFact = {
    id: `identity-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    key: detection.extractedKey,
    value: detection.extractedValue,
    category: detection.extractedKey === "name" ? "identity" : "preference",
    confidence: detection.confidence,
    confirmationCount: 1,
    lastConfirmed: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    source: "explicit",
  };
  
  await addIdentityFact(newFact);
  
  return {
    success: true,
    layer: "identity",
    message: `Stored identity fact: ${detection.extractedKey}=${detection.extractedValue}`,
  };
};

// Write to Experience Memory (hybrid)
const writeExperience = async (
  content: string,
  role: "user" | "assistant",
  context: ContextType
): Promise<WriteResult> => {
  const importance = calculateImportance(content, role);
  
  let embedding: number[] | undefined;
  if (getEmbeddingStatus() === "ready") {
    try {
      embedding = await generateEmbedding(content);
    } catch (error) {
      console.warn("Could not generate embedding for experience:", error);
    }
  }
  
  const entry: ExperienceEntry = {
    id: `exp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    content,
    context,
    timestamp: new Date().toISOString(),
    importance,
    originalImportance: importance,
    role,
    embedding,
  };
  
  await addExperience(entry);
  
  return {
    success: true,
    layer: "experience",
    message: `Stored experience in ${context} context`,
  };
};

// Write to Knowledge Memory
const writeKnowledge = async (
  content: string,
  detection: ReturnType<typeof detectMemoryIntent>
): Promise<WriteResult> => {
  if (getEmbeddingStatus() !== "ready") {
    return {
      success: false,
      layer: "knowledge",
      message: "Embeddings not ready for knowledge storage",
    };
  }
  
  try {
    const embedding = await generateEmbedding(content);
    
    const entry: KnowledgeEntry = {
      id: `know-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      content,
      category: detection.isKnowledgeStatement ? "skill" : "fact",
      embedding,
      confidence: 0.6,
      reinforcementCount: 0,
      timestamp: new Date().toISOString(),
    };
    
    await addKnowledge(entry);
    
    return {
      success: true,
      layer: "knowledge",
      message: "Stored as knowledge",
    };
  } catch (error) {
    return {
      success: false,
      layer: "knowledge",
      message: `Failed to store knowledge: ${error}`,
    };
  }
};

// Resolve conflict by updating identity
export const resolveConflict = async (
  conflict: MemoryConflict,
  action: "keep_existing" | "update_new" | "ask_later"
): Promise<void> => {
  if (action === "update_new") {
    const updatedFact: IdentityFact = {
      ...conflict.existingFact,
      value: conflict.newValue,
      confidence: 0.7, // Reset confidence for updated value
      confirmationCount: 1,
      lastConfirmed: new Date().toISOString(),
    };
    await addIdentityFact(updatedFact);
  } else if (action === "keep_existing") {
    // Reinforce existing
    await updateIdentityConfidence(conflict.existingFact.id, conflict.existingFact.confidence + 0.1);
  }
  // "ask_later" does nothing, conflict remains for next time
};
