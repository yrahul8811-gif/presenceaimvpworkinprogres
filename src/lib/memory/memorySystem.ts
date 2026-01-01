// Main Memory System - Coordinates router and stores

import type { 
  Layer, 
  ContextType, 
  MemoryResult, 
  MemoryWriteRequest, 
  WriteResult,
  IdentityFact,
  ExperienceEntry,
  KnowledgeEntry,
  MemoryConflict
} from "./types";
import { router } from "./router";
import { extractIdentityFact } from "./hardRules";
import { generateEmbedding, getEmbeddingStatus, initEmbeddings } from "./embeddings";
import { calculateImportance, generateId, detectContext } from "./utils";
import {
  addIdentityFact,
  getIdentityByKey,
  updateIdentityConfidence,
  getAllIdentityFacts,
  searchIdentityFacts,
  clearIdentityMemory,
  getIdentityCount,
} from "./stores/identityStore";
import {
  addExperience,
  searchExperiencesSemantic,
  getAllExperiences,
  clearExperienceMemory,
  getExperienceCount,
  applyExperienceDecay,
} from "./stores/experienceStore";
import {
  addKnowledge,
  searchKnowledgeSemantic,
  getAllKnowledge,
  clearKnowledgeMemory,
  getKnowledgeCount,
} from "./stores/knowledgeStore";

export interface RetrievalOptions {
  contextFilter?: ContextType;
  includeIdentity?: boolean;
  includeExperience?: boolean;
  includeKnowledge?: boolean;
  topK?: number;
  semanticThreshold?: number;
}

const CONFIDENCE_THRESHOLD = 0.5;

// Initialize the memory system
export const initMemorySystem = async (): Promise<void> => {
  await router.init();
};

// Main retrieval pipeline - follows strict precedence: IMM → EMM → KMM
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

  // Step 1: Query Identity Memory first (exact, highest priority)
  if (includeIdentity) {
    const identityResults = await searchIdentityFacts(query);
    for (const fact of identityResults.slice(0, 3)) {
      if (fact.confidence >= CONFIDENCE_THRESHOLD) {
        results.push({
          layer: "IMM",
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

  // Step 2: Query Experience Memory (semantic search)
  if (includeExperience && getEmbeddingStatus() === "ready") {
    try {
      const queryEmbedding = await generateEmbedding(query);
      const contextExperiences = await searchExperiencesSemantic(
        queryEmbedding,
        topK,
        semanticThreshold,
        contextFilter
      );
      
      for (const exp of contextExperiences) {
        results.push({
          layer: "EMM",
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
        semanticThreshold * 0.8
      );
      
      for (const know of knowledgeResults) {
        results.push({
          layer: "KMM",
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

  // Sort by layer priority, then by confidence
  return results.sort((a, b) => {
    const layerPriority = { IMM: 3, EMM: 2, KMM: 1 };
    const layerDiff = layerPriority[b.layer] - layerPriority[a.layer];
    if (layerDiff !== 0) return layerDiff;
    
    const aScore = a.similarity || a.confidence;
    const bScore = b.similarity || b.confidence;
    return bScore - aScore;
  }).slice(0, topK);
};

// Write memory with ML-based routing
export const writeMemory = async (
  request: MemoryWriteRequest
): Promise<WriteResult> => {
  const { content, role, context = "general", forceLayer } = request;
  
  // Use router to determine layer
  let targetLayer: Layer;
  
  if (forceLayer) {
    targetLayer = forceLayer;
  } else {
    const routingResult = await router.route(content, []);
    
    if (routingResult.decision === "NONE") {
      return {
        success: false,
        layer: "EMM",
        message: "Content blocked by safety rules",
      };
    }
    
    if (routingResult.decision === "ASK" || routingResult.decision === "CONFLICT") {
      // Default to EMM when uncertain
      targetLayer = "EMM";
    } else {
      targetLayer = routingResult.decision;
    }
  }
  
  // Ensure embeddings ready for EMM/KMM
  if ((targetLayer === "EMM" || targetLayer === "KMM") && getEmbeddingStatus() !== "ready") {
    try {
      await initEmbeddings();
    } catch (error) {
      console.warn("Could not initialize embeddings");
    }
  }
  
  // Route to appropriate store
  switch (targetLayer) {
    case "IMM":
      return await writeIdentity(content);
    case "EMM":
      return await writeExperience(content, role, context);
    case "KMM":
      return await writeKnowledge(content);
    default:
      return await writeExperience(content, role, context);
  }
};

// Write to Identity Memory
const writeIdentity = async (content: string): Promise<WriteResult> => {
  const extraction = extractIdentityFact(content);
  
  if (!extraction.key || !extraction.value) {
    return {
      success: false,
      layer: "IMM",
      message: "Could not extract identity fact",
    };
  }
  
  // Check for existing fact
  const existing = await getIdentityByKey(extraction.key);
  
  if (existing) {
    if (existing.value.toLowerCase() !== extraction.value.toLowerCase()) {
      // Conflict detected
      return {
        success: false,
        layer: "IMM",
        conflict: {
          existingFact: existing,
          newValue: extraction.value,
          suggestedAction: existing.confidence > 0.8 ? "ask_user" : "update",
        },
        message: `Conflict: ${extraction.key}="${existing.value}" vs "${extraction.value}"`,
      };
    } else {
      // Reinforce existing
      await updateIdentityConfidence(existing.id, existing.confidence + 0.1);
      return {
        success: true,
        layer: "IMM",
        message: "Identity fact reinforced",
      };
    }
  }
  
  // Create new fact
  const newFact: IdentityFact = {
    id: generateId("imm"),
    key: extraction.key,
    value: extraction.value,
    category: extraction.key === "name" ? "identity" : "preference",
    confidence: 0.8,
    confirmationCount: 1,
    lastConfirmed: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    source: "explicit",
  };
  
  await addIdentityFact(newFact);
  
  return {
    success: true,
    layer: "IMM",
    message: `Stored: ${extraction.key}=${extraction.value}`,
  };
};

// Write to Experience Memory
const writeExperience = async (
  content: string,
  role: "user" | "assistant",
  context: ContextType
): Promise<WriteResult> => {
  const importance = calculateImportance(content, role);
  const detectedContext = detectContext(content) || context;
  
  let embedding: number[] | undefined;
  if (getEmbeddingStatus() === "ready") {
    try {
      embedding = await generateEmbedding(content);
    } catch (error) {
      console.warn("Could not generate embedding:", error);
    }
  }
  
  const entry: ExperienceEntry = {
    id: generateId("emm"),
    content,
    context: detectedContext,
    timestamp: new Date().toISOString(),
    importance,
    originalImportance: importance,
    role,
    embedding,
  };
  
  await addExperience(entry);
  
  return {
    success: true,
    layer: "EMM",
    message: `Stored experience in ${detectedContext} context`,
  };
};

// Write to Knowledge Memory
const writeKnowledge = async (content: string): Promise<WriteResult> => {
  if (getEmbeddingStatus() !== "ready") {
    return {
      success: false,
      layer: "KMM",
      message: "Embeddings not ready",
    };
  }
  
  try {
    const embedding = await generateEmbedding(content);
    
    const entry: KnowledgeEntry = {
      id: generateId("kmm"),
      content,
      category: "skill",
      embedding,
      confidence: 0.6,
      reinforcementCount: 0,
      timestamp: new Date().toISOString(),
    };
    
    await addKnowledge(entry);
    
    return {
      success: true,
      layer: "KMM",
      message: "Stored as knowledge",
    };
  } catch (error) {
    return {
      success: false,
      layer: "KMM",
      message: `Failed: ${error}`,
    };
  }
};

// Resolve conflict
export const resolveConflict = async (
  conflict: MemoryConflict,
  action: "keep_existing" | "update_new" | "ask_later"
): Promise<void> => {
  if (action === "update_new") {
    const updatedFact: IdentityFact = {
      ...conflict.existingFact,
      value: conflict.newValue,
      confidence: 0.7,
      confirmationCount: 1,
      lastConfirmed: new Date().toISOString(),
    };
    await addIdentityFact(updatedFact);
  } else if (action === "keep_existing") {
    await updateIdentityConfidence(
      conflict.existingFact.id, 
      conflict.existingFact.confidence + 0.1
    );
  }
};

// Teach router when it made a mistake
export const teachRouter = async (
  text: string,
  correctLayer: Layer
): Promise<void> => {
  await router.learn(text, [], correctLayer);
};

// Re-exports for convenience
export {
  getAllIdentityFacts,
  clearIdentityMemory,
  getIdentityCount,
  getAllExperiences,
  clearExperienceMemory,
  getExperienceCount,
  applyExperienceDecay,
  getAllKnowledge,
  clearKnowledgeMemory,
  getKnowledgeCount,
};

export { detectContext };
