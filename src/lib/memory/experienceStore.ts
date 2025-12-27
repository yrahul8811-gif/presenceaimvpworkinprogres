// Layer 2: Experience Memory Store (Hybrid DB + Vector)
// Stores both structured metadata and embeddings for semantic search

import type { ExperienceEntry, ContextType } from "./types";
import { cosineSimilarity } from "../vectorStore";

const DB_NAME = "presence-ai-experiences";
const STORE_NAME = "experiences";
const DB_VERSION = 1;

let db: IDBDatabase | null = null;

// Decay configuration
const DECAY_RATE = 0.95; // Per day
const MIN_IMPORTANCE = 0.1;
const IMPORTANCE_THRESHOLD = 0.2;

export const initExperienceDB = (): Promise<IDBDatabase> => {
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
        store.createIndex("context", "context", { unique: false });
        store.createIndex("timestamp", "timestamp", { unique: false });
        store.createIndex("importance", "importance", { unique: false });
        store.createIndex("role", "role", { unique: false });
      }
    };
  });
};

export const addExperience = async (entry: ExperienceEntry): Promise<void> => {
  const database = await initExperienceDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(entry);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};

export const getAllExperiences = async (): Promise<ExperienceEntry[]> => {
  const database = await initExperienceDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
};

export const getExperiencesByContext = async (
  context: ContextType
): Promise<ExperienceEntry[]> => {
  const database = await initExperienceDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index("context");
    const request = index.getAll(context);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
};

// Semantic search within experiences
export const searchExperiencesSemantic = async (
  queryEmbedding: number[],
  topK: number = 5,
  threshold: number = 0.4,
  contextFilter?: ContextType
): Promise<(ExperienceEntry & { similarity: number })[]> => {
  let experiences = await getAllExperiences();
  
  // Apply context filter if provided
  if (contextFilter) {
    experiences = experiences.filter(e => e.context === contextFilter);
  }
  
  // Filter to only entries with embeddings
  const withEmbeddings = experiences.filter(e => e.embedding && e.embedding.length > 0);
  
  // Calculate similarity and apply importance weighting
  const results = withEmbeddings
    .map((entry) => {
      const similarity = cosineSimilarity(queryEmbedding, entry.embedding!);
      // Weight by importance and recency
      const daysSince = (Date.now() - new Date(entry.timestamp).getTime()) / (1000 * 60 * 60 * 24);
      const recencyBoost = Math.max(0.5, 1 - (daysSince / 30)); // Decay over 30 days
      const weightedScore = similarity * entry.importance * recencyBoost;
      
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

// Apply decay to all experiences (should be called periodically)
export const applyExperienceDecay = async (): Promise<void> => {
  const database = await initExperienceDB();
  const experiences = await getAllExperiences();
  const now = Date.now();
  
  const transaction = database.transaction([STORE_NAME], "readwrite");
  const store = transaction.objectStore(STORE_NAME);
  
  for (const exp of experiences) {
    const daysSinceCreation = (now - new Date(exp.timestamp).getTime()) / (1000 * 60 * 60 * 24);
    const decayedImportance = exp.originalImportance * Math.pow(DECAY_RATE, daysSinceCreation);
    const newImportance = Math.max(MIN_IMPORTANCE, decayedImportance);
    
    if (newImportance !== exp.importance) {
      exp.importance = newImportance;
      store.put(exp);
    }
  }
};

// Get recent experiences (no semantic search, just recency)
export const getRecentExperiences = async (
  limit: number = 10,
  contextFilter?: ContextType
): Promise<ExperienceEntry[]> => {
  let experiences = await getAllExperiences();
  
  if (contextFilter) {
    experiences = experiences.filter(e => e.context === contextFilter);
  }
  
  return experiences
    .filter(e => e.importance >= IMPORTANCE_THRESHOLD)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);
};

export const deleteExperience = async (id: string): Promise<void> => {
  const database = await initExperienceDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};

export const clearExperienceMemory = async (): Promise<void> => {
  const database = await initExperienceDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};

export const getExperienceCount = async (): Promise<number> => {
  const database = await initExperienceDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.count();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
};
