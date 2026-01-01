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

// Generate unique ID
export const generateId = (prefix: string): string => {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Calculate importance score for experiences
export const calculateImportance = (text: string, role: "user" | "assistant"): number => {
  let importance = 0.5; // Base importance
  
  // User messages slightly more important
  if (role === "user") {
    importance += 0.1;
  }
  
  // Emotional content is more important
  const emotionalWords = ["love", "hate", "fear", "hope", "dream", "worry", "excited", "sad", "happy", "angry", "frustrated"];
  const emotionalCount = emotionalWords.filter(w => text.toLowerCase().includes(w)).length;
  importance += Math.min(0.2, emotionalCount * 0.05);
  
  // Questions are important (seeking info)
  if (text.includes("?")) {
    importance += 0.1;
  }
  
  // Longer, detailed messages are more important
  const wordCount = text.split(/\s+/).length;
  if (wordCount > 20) {
    importance += 0.1;
  }
  
  return Math.min(1, importance);
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

// Context detection
const CONTEXT_KEYWORDS: Record<string, string[]> = {
  family: ["mom", "dad", "mother", "father", "parent", "sibling", "brother", "sister", "family", "home", "grandma", "grandpa", "aunt", "uncle", "cousin", "wife", "husband", "spouse", "kid", "child", "son", "daughter"],
  work: ["work", "job", "office", "boss", "colleague", "coworker", "project", "meeting", "deadline", "salary", "career", "promotion", "client", "business", "professional", "company", "manager", "team"],
  college: ["college", "university", "school", "class", "professor", "teacher", "exam", "test", "grade", "study", "student", "campus", "lecture", "homework", "assignment", "degree", "major", "semester"],
  personal: ["myself", "i feel", "i think", "i believe", "my opinion", "personally", "my life", "my goal", "my dream", "my fear", "my hope"],
  health: ["health", "doctor", "hospital", "medicine", "sick", "illness", "exercise", "diet", "sleep", "mental", "therapy", "anxiety", "depression", "stress", "workout", "gym", "weight"],
  hobby: ["hobby", "game", "music", "movie", "book", "art", "sport", "travel", "cooking", "reading", "playing", "watching", "listening", "collecting", "photography", "painting"],
};

export const detectContext = (text: string): "general" | "family" | "work" | "college" | "personal" | "health" | "hobby" => {
  const lowerText = text.toLowerCase();
  let bestContext: "general" | "family" | "work" | "college" | "personal" | "health" | "hobby" = "general";
  let maxMatches = 0;

  for (const [context, keywords] of Object.entries(CONTEXT_KEYWORDS)) {
    const matches = keywords.filter(kw => lowerText.includes(kw)).length;
    if (matches > maxMatches) {
      maxMatches = matches;
      bestContext = context as typeof bestContext;
    }
  }

  return bestContext;
};
