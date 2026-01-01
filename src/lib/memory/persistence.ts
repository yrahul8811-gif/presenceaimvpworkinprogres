// Persistence layer for router weights and corrections using IndexedDB

import type { RouterWeights, CorrectionEntry } from "./types";

const DB_NAME = "presence-ai-router";
const STORE_NAME = "router_data";
const DB_VERSION = 1;

let db: IDBDatabase | null = null;

const initDB = (): Promise<IDBDatabase> => {
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
        database.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };
  });
};

// Save router weights
export const saveRouterWeights = async (weights: RouterWeights): Promise<void> => {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put({ key: "weights", data: weights });
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};

// Load router weights
export const loadRouterWeights = async (): Promise<RouterWeights | null> => {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get("weights");
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      resolve(request.result?.data || null);
    };
  });
};

// Add correction to history
export const addCorrection = async (entry: CorrectionEntry): Promise<void> => {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    
    // Get existing corrections
    const getRequest = store.get("corrections");
    getRequest.onsuccess = () => {
      const corrections: CorrectionEntry[] = getRequest.result?.data || [];
      corrections.push(entry);
      
      const putRequest = store.put({ key: "corrections", data: corrections });
      putRequest.onerror = () => reject(putRequest.error);
      putRequest.onsuccess = () => resolve();
    };
    getRequest.onerror = () => reject(getRequest.error);
  });
};

// Load correction history
export const loadCorrections = async (): Promise<CorrectionEntry[]> => {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get("corrections");
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      resolve(request.result?.data || []);
    };
  });
};

// Clear all router data
export const clearRouterData = async (): Promise<void> => {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};
