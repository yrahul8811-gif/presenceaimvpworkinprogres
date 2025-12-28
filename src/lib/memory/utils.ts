// Memory utility functions

// Cosine similarity between two vectors
export const cosineSimilarity = (a: number[], b: number[]): number => {
  if (a.length !== b.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  return magnitude === 0 ? 0 : dotProduct / magnitude;
};

// Cleanup old IndexedDB databases
export const cleanupLegacyDatabases = async (): Promise<void> => {
  const legacyDBs = ["presence-ai-memory"];
  
  for (const dbName of legacyDBs) {
    try {
      const deleteRequest = indexedDB.deleteDatabase(dbName);
      deleteRequest.onsuccess = () => {
        console.log(`Cleaned up legacy database: ${dbName}`);
      };
      deleteRequest.onerror = () => {
        console.warn(`Failed to delete legacy database: ${dbName}`);
      };
    } catch (error) {
      console.warn(`Error cleaning up ${dbName}:`, error);
    }
  }
};
