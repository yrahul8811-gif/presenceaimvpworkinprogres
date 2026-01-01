import { useState, useEffect, useCallback } from "react";
import { 
  retrieveMemories, 
  writeMemory, 
  resolveConflict,
  cleanupLegacyDatabases,
  initMemorySystem,
  getAllIdentityFacts,
  clearIdentityMemory,
  getIdentityCount,
  clearExperienceMemory,
  getExperienceCount,
  applyExperienceDecay,
  clearKnowledgeMemory,
  getKnowledgeCount,
  onStatusChange,
  type RetrievalOptions,
  type WriteResult,
  type MemoryResult,
  type ContextType,
  type IdentityFact,
  type MemoryConflict,
  type EmbeddingStatus,
} from "@/lib/memory";

export interface MemoryCounts {
  identity: number;
  experience: number;
  knowledge: number;
  total: number;
}

export interface MemorySystemState {
  status: EmbeddingStatus;
  counts: MemoryCounts;
  isProcessing: boolean;
  pendingConflict: MemoryConflict | null;
}

export const useMemorySystem = () => {
  const [status, setStatus] = useState<EmbeddingStatus>("idle");
  const [counts, setCounts] = useState<MemoryCounts>({
    identity: 0,
    experience: 0,
    knowledge: 0,
    total: 0,
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingConflict, setPendingConflict] = useState<MemoryConflict | null>(null);

  // Refresh counts
  const refreshCounts = useCallback(async () => {
    try {
      const [identity, experience, knowledge] = await Promise.all([
        getIdentityCount(),
        getExperienceCount(),
        getKnowledgeCount(),
      ]);
      setCounts({
        identity,
        experience,
        knowledge,
        total: identity + experience + knowledge,
      });
    } catch (error) {
      console.error("Failed to refresh counts:", error);
    }
  }, []);

  useEffect(() => {
    // Clean up any legacy memory databases
    cleanupLegacyDatabases();
    
    // Subscribe to embedding status changes
    const unsubscribe = onStatusChange(setStatus);
    
    // Initial count refresh
    refreshCounts();
    
    // Apply experience decay periodically (every hour)
    const decayInterval = setInterval(() => {
      applyExperienceDecay().catch(console.error);
    }, 60 * 60 * 1000);
    
    return () => {
      unsubscribe();
      clearInterval(decayInterval);
    };
  }, [refreshCounts]);

  // Initialize memory system (router + embeddings)
  const initializeModel = useCallback(async () => {
    try {
      await initMemorySystem();
    } catch (error) {
      console.error("Failed to initialize memory system:", error);
    }
  }, []);

  // Store memory with ML-based routing
  const storeMemory = useCallback(async (
    content: string,
    role: "user" | "assistant",
    context?: ContextType
  ): Promise<WriteResult> => {
    setIsProcessing(true);
    try {
      const result = await writeMemory({ content, role, context });
      
      // Handle conflicts
      if (result.conflict) {
        setPendingConflict(result.conflict);
      }
      
      await refreshCounts();
      return result;
    } finally {
      setIsProcessing(false);
    }
  }, [refreshCounts]);

  // Retrieve memories following precedence: IMM → EMM → KMM
  const recallMemories = useCallback(async (
    query: string,
    options?: RetrievalOptions
  ): Promise<MemoryResult[]> => {
    if (status !== "ready") {
      console.warn("Embeddings not ready for semantic search");
      // Still return identity facts (don't need embeddings)
      return retrieveMemories(query, {
        ...options,
        includeExperience: false,
        includeKnowledge: false,
      });
    }

    setIsProcessing(true);
    try {
      return await retrieveMemories(query, options);
    } finally {
      setIsProcessing(false);
    }
  }, [status]);

  // Get all identity facts (for display in UI)
  const getIdentityFacts = useCallback(async (): Promise<IdentityFact[]> => {
    return getAllIdentityFacts();
  }, []);

  // Resolve memory conflict
  const handleConflictResolution = useCallback(async (
    action: "keep_existing" | "update_new" | "ask_later"
  ) => {
    if (!pendingConflict) return;
    
    await resolveConflict(pendingConflict, action);
    setPendingConflict(null);
    await refreshCounts();
  }, [pendingConflict, refreshCounts]);

  // Clear all memory
  const clearAllMemory = useCallback(async () => {
    await Promise.all([
      clearIdentityMemory(),
      clearExperienceMemory(),
      clearKnowledgeMemory(),
    ]);
    await refreshCounts();
  }, [refreshCounts]);

  // Clear specific layer
  const clearLayer = useCallback(async (layer: "identity" | "experience" | "knowledge") => {
    switch (layer) {
      case "identity":
        await clearIdentityMemory();
        break;
      case "experience":
        await clearExperienceMemory();
        break;
      case "knowledge":
        await clearKnowledgeMemory();
        break;
    }
    await refreshCounts();
  }, [refreshCounts]);

  // Format memories for prompt injection
  const formatMemoriesForPrompt = useCallback((memories: MemoryResult[]): string => {
    if (memories.length === 0) return "";

    const grouped = {
      identity: memories.filter(m => m.layer === "IMM"),
      experience: memories.filter(m => m.layer === "EMM"),
      knowledge: memories.filter(m => m.layer === "KMM"),
    };

    const parts: string[] = [];

    if (grouped.identity.length > 0) {
      parts.push("## User Identity (MUST respect):");
      grouped.identity.forEach(m => {
        parts.push(`- ${m.content}`);
      });
    }

    if (grouped.experience.length > 0) {
      parts.push("\n## Relevant Past Experiences:");
      grouped.experience.forEach(m => {
        const role = m.metadata?.role === "user" ? "User" : "AI";
        parts.push(`- [${role}]: ${m.content}`);
      });
    }

    if (grouped.knowledge.length > 0) {
      parts.push("\n## User's Knowledge/Skills:");
      grouped.knowledge.forEach(m => {
        parts.push(`- ${m.content}`);
      });
    }

    return parts.join("\n");
  }, []);

  return {
    // State
    status,
    counts,
    isProcessing,
    pendingConflict,
    
    // Actions
    initializeModel,
    storeMemory,
    recallMemories,
    getIdentityFacts,
    handleConflictResolution,
    clearAllMemory,
    clearLayer,
    refreshCounts,
    
    // Utilities
    formatMemoriesForPrompt,
  };
};
