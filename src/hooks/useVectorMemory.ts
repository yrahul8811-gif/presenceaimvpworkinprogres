import { useState, useEffect, useCallback } from "react";
import { 
  initVectorDB, 
  addVector, 
  searchSimilar, 
  clearAllVectors, 
  getVectorCount,
  type VectorEntry 
} from "@/lib/vectorStore";
import { 
  generateEmbedding, 
  initEmbeddings, 
  onStatusChange, 
  type EmbeddingStatus 
} from "@/lib/embeddings";

export interface MemoryEntry {
  id: string;
  content: string;
  timestamp: string;
  role: "user" | "assistant";
  similarity?: number;
}

export const useVectorMemory = () => {
  const [status, setStatus] = useState<EmbeddingStatus>("idle");
  const [memoryCount, setMemoryCount] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    // Initialize the database
    initVectorDB().catch(console.error);
    
    // Subscribe to embedding status changes
    const unsubscribe = onStatusChange(setStatus);
    
    // Update memory count
    getVectorCount().then(setMemoryCount).catch(console.error);
    
    return unsubscribe;
  }, []);

  const initializeModel = useCallback(async () => {
    try {
      await initEmbeddings();
    } catch (error) {
      console.error("Failed to initialize embeddings:", error);
    }
  }, []);

  const storeMemory = useCallback(async (
    content: string, 
    role: "user" | "assistant",
    metadata?: Record<string, any>
  ): Promise<void> => {
    if (status !== "ready") {
      console.warn("Embeddings model not ready, initializing...");
      await initEmbeddings();
    }

    setIsProcessing(true);
    try {
      const embedding = await generateEmbedding(content);
      const entry: VectorEntry = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        content,
        embedding,
        timestamp: new Date().toISOString(),
        metadata: { role, ...metadata },
      };
      
      await addVector(entry);
      const count = await getVectorCount();
      setMemoryCount(count);
    } finally {
      setIsProcessing(false);
    }
  }, [status]);

  const recallMemories = useCallback(async (
    query: string,
    topK: number = 5,
    threshold: number = 0.4
  ): Promise<MemoryEntry[]> => {
    if (status !== "ready") {
      console.warn("Embeddings model not ready");
      return [];
    }

    setIsProcessing(true);
    try {
      const queryEmbedding = await generateEmbedding(query);
      const results = await searchSimilar(queryEmbedding, topK, threshold);
      
      return results.map((entry) => ({
        id: entry.id,
        content: entry.content,
        timestamp: entry.timestamp,
        role: entry.metadata?.role || "user",
        similarity: entry.similarity,
      }));
    } finally {
      setIsProcessing(false);
    }
  }, [status]);

  const clearMemory = useCallback(async (): Promise<void> => {
    await clearAllVectors();
    setMemoryCount(0);
  }, []);

  const refreshCount = useCallback(async () => {
    const count = await getVectorCount();
    setMemoryCount(count);
  }, []);

  return {
    status,
    memoryCount,
    isProcessing,
    initializeModel,
    storeMemory,
    recallMemories,
    clearMemory,
    refreshCount,
  };
};
