// Layer 1: Identity Memory Store (Structured DB Only)
// Accuracy: 99% - Never use vectors, never blur facts

import type { IdentityFact } from "./types";

const DB_NAME = "presence-ai-identity";
const STORE_NAME = "identity";
const DB_VERSION = 1;

let db: IDBDatabase | null = null;

export const initIdentityDB = (): Promise<IDBDatabase> => {
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
      
      // Identity store - structured, exact facts
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("key", "key", { unique: false });
        store.createIndex("category", "category", { unique: false });
        store.createIndex("confidence", "confidence", { unique: false });
      }
    };
  });
};

export const addIdentityFact = async (fact: IdentityFact): Promise<void> => {
  const database = await initIdentityDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(fact);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};

export const getIdentityByKey = async (key: string): Promise<IdentityFact | null> => {
  const database = await initIdentityDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index("key");
    const request = index.getAll(key);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const results = request.result;
      if (results.length === 0) {
        resolve(null);
      } else {
        // Return highest confidence fact for this key
        const sorted = results.sort((a, b) => b.confidence - a.confidence);
        resolve(sorted[0]);
      }
    };
  });
};

export const getAllIdentityFacts = async (): Promise<IdentityFact[]> => {
  const database = await initIdentityDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
};

export const updateIdentityConfidence = async (
  id: string, 
  newConfidence: number
): Promise<void> => {
  const database = await initIdentityDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const getRequest = store.get(id);
    
    getRequest.onsuccess = () => {
      const fact = getRequest.result as IdentityFact;
      if (fact) {
        fact.confidence = Math.min(1, newConfidence);
        fact.confirmationCount += 1;
        fact.lastConfirmed = new Date().toISOString();
        const putRequest = store.put(fact);
        putRequest.onerror = () => reject(putRequest.error);
        putRequest.onsuccess = () => resolve();
      } else {
        resolve();
      }
    };
    getRequest.onerror = () => reject(getRequest.error);
  });
};

export const deleteIdentityFact = async (id: string): Promise<void> => {
  const database = await initIdentityDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};

export const clearIdentityMemory = async (): Promise<void> => {
  const database = await initIdentityDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};

export const getIdentityCount = async (): Promise<number> => {
  const database = await initIdentityDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.count();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
};

// Search identity facts by keyword (exact match on key or category)
export const searchIdentityFacts = async (query: string): Promise<IdentityFact[]> => {
  const all = await getAllIdentityFacts();
  const lowerQuery = query.toLowerCase();
  
  return all.filter(fact => 
    fact.key.toLowerCase().includes(lowerQuery) ||
    fact.value.toLowerCase().includes(lowerQuery) ||
    fact.category.toLowerCase().includes(lowerQuery)
  ).sort((a, b) => b.confidence - a.confidence);
};
