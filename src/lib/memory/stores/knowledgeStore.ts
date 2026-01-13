// Layer 3: Knowledge Memory Store (KMM)
// Vector-first with metadata for skills and concepts

import type { KnowledgeEntry } from "../types";
import { cosineSimilarity } from "../utils";

const DB_NAME = "presence-ai-knowledge";
const STORE_NAME = "knowledge";
const DB_VERSION = 1;

let db: IDBDatabase | null = null;

export const initKnowledgeDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("category", "category", { unique: false });
        store.createIndex("confidence", "confidence", { unique: false });
        store.createIndex("timestamp", "timestamp", { unique: false });
      }
    };
  });
};

// Add knowledge with duplicate detection based on embedding similarity
export const addKnowledge = async (entry: KnowledgeEntry): Promise<void> => {
  const database = await initKnowledgeDB();
  
  // Check for duplicates based on content similarity
  const existing = await getAllKnowledge();
  const isDuplicate = existing.some(k => {
    // Exact content match
    if (k.content.toLowerCase().trim() === entry.content.toLowerCase().trim()) {
      return true;
    }
    // If both have embeddings, check cosine similarity > 0.95
    if (k.embedding && entry.embedding && k.embedding.length > 0 && entry.embedding.length > 0) {
      const similarity = cosineSimilarity(k.embedding, entry.embedding);
      return similarity > 0.95;
    }
    return false;
  });
  
  if (isDuplicate) {
    console.log("Skipping duplicate knowledge:", entry.content.substring(0, 50));
    return;
  }
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(entry);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};

export const getAllKnowledge = async (): Promise<KnowledgeEntry[]> => {
  const database = await initKnowledgeDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
};

// Primary search method - semantic similarity
export const searchKnowledgeSemantic = async (
  queryEmbedding: number[],
  topK: number = 5,
  threshold: number = 0.3
): Promise<(KnowledgeEntry & { similarity: number })[]> => {
  const knowledge = await getAllKnowledge();
  
  const results = knowledge
    .map((entry) => {
      const similarity = cosineSimilarity(queryEmbedding, entry.embedding);
      // Boost by reinforcement count
      const reinforcementBoost = 1 + (entry.reinforcementCount * 0.1);
      const weightedScore = similarity * entry.confidence * Math.min(reinforcementBoost, 2);
      
      return {
        ...entry,
        similarity: weightedScore,
      };
    })
    .filter((entry) => entry.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);
  
  return results;
};

export const getKnowledgeByCategory = async (
  category: string
): Promise<KnowledgeEntry[]> => {
  const database = await initKnowledgeDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index("category");
    const request = index.getAll(category);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
};

// Reinforce knowledge when referenced
export const reinforceKnowledge = async (id: string): Promise<void> => {
  const database = await initKnowledgeDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const getRequest = store.get(id);
    
    getRequest.onsuccess = () => {
      const entry = getRequest.result as KnowledgeEntry;
      if (entry) {
        entry.reinforcementCount += 1;
        entry.confidence = Math.min(1, entry.confidence + 0.05);
        const putRequest = store.put(entry);
        putRequest.onerror = () => reject(putRequest.error);
        putRequest.onsuccess = () => resolve();
      } else {
        resolve();
      }
    };
    getRequest.onerror = () => reject(getRequest.error);
  });
};

export const updateKnowledge = async (
  id: string,
  updates: Partial<Pick<KnowledgeEntry, "content" | "category">>
): Promise<void> => {
  const database = await initKnowledgeDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const getRequest = store.get(id);
    
    getRequest.onsuccess = () => {
      const entry = getRequest.result as KnowledgeEntry;
      if (entry) {
        const updatedEntry = { ...entry, ...updates };
        const putRequest = store.put(updatedEntry);
        putRequest.onerror = () => reject(putRequest.error);
        putRequest.onsuccess = () => resolve();
      } else {
        resolve();
      }
    };
    getRequest.onerror = () => reject(getRequest.error);
  });
};

export const deleteKnowledge = async (id: string): Promise<void> => {
  const database = await initKnowledgeDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};

export const clearKnowledgeMemory = async (): Promise<void> => {
  const database = await initKnowledgeDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};

export const getKnowledgeCount = async (): Promise<number> => {
  const database = await initKnowledgeDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.count();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
};
