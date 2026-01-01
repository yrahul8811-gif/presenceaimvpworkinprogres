// Main index for memory system exports

// Types
export type {
  Layer,
  Decision,
  ContextType,
  RoutingResult,
  IdentityFact,
  ExperienceEntry,
  KnowledgeEntry,
  MemoryResult,
  MemoryWriteRequest,
  WriteResult,
  MemoryConflict,
} from "./types";

// Main memory system functions
export {
  initMemorySystem,
  retrieveMemories,
  writeMemory,
  resolveConflict,
  teachRouter,
  detectContext,
  // Store access
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
  type RetrievalOptions,
} from "./memorySystem";

// Store-level access (for MemoryBrowser)
export {
  deleteIdentityFact,
} from "./stores/identityStore";

export {
  deleteExperience,
} from "./stores/experienceStore";

export {
  deleteKnowledge,
} from "./stores/knowledgeStore";

// Router access
export { router } from "./router";

// Embeddings
export {
  initEmbeddings,
  getEmbeddingStatus,
  onStatusChange,
  type EmbeddingStatus,
} from "./embeddings";

// Utils
export { cleanupLegacyDatabases, calculateImportance } from "./utils";
