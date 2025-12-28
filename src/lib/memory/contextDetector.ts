// Context & Intent Detection for Memory Routing

import type { ContextType, MemoryLayer } from "./types";

// Keywords that indicate different contexts
const CONTEXT_KEYWORDS: Record<ContextType, string[]> = {
  family: ["mom", "dad", "mother", "father", "parent", "sibling", "brother", "sister", "family", "home", "grandma", "grandpa", "aunt", "uncle", "cousin", "wife", "husband", "spouse", "kid", "child", "son", "daughter"],
  work: ["work", "job", "office", "boss", "colleague", "coworker", "project", "meeting", "deadline", "salary", "career", "promotion", "client", "business", "professional", "company", "manager", "team"],
  college: ["college", "university", "school", "class", "professor", "teacher", "exam", "test", "grade", "study", "student", "campus", "lecture", "homework", "assignment", "degree", "major", "semester"],
  personal: ["myself", "i feel", "i think", "i believe", "my opinion", "personally", "my life", "my goal", "my dream", "my fear", "my hope"],
  health: ["health", "doctor", "hospital", "medicine", "sick", "illness", "exercise", "diet", "sleep", "mental", "therapy", "anxiety", "depression", "stress", "workout", "gym", "weight"],
  hobby: ["hobby", "game", "music", "movie", "book", "art", "sport", "travel", "cooking", "reading", "playing", "watching", "listening", "collecting", "photography", "painting"],
  general: [],
};

// Keywords that indicate identity statements (Layer 1)
const IDENTITY_INDICATORS = [
  "i am", "i'm", "my name is", "i always", "i never", "i don't", "i won't",
  "i prefer", "i hate", "i love", "i can't stand", "i believe in",
  "please don't", "please never", "stop suggesting", "i'm allergic",
  "i'm vegetarian", "i'm vegan", "i don't eat", "i don't drink",
  "my religion", "my faith", "i follow", "i practice",
  "i identify as", "call me", "refer to me as",
];

// Keywords that indicate knowledge/skill statements (Layer 3)
const KNOWLEDGE_INDICATORS = [
  "i know", "i learned", "i understand", "i can", "i'm good at",
  "i've studied", "i've practiced", "i work with", "i use",
  "i'm familiar with", "i've worked on", "i specialize in",
  "i'm learning", "i'm studying", "i've been",
];

export interface DetectionResult {
  context: ContextType;
  suggestedLayer: MemoryLayer;
  confidence: number;
  isIdentityStatement: boolean;
  isKnowledgeStatement: boolean;
  extractedKey?: string;      // For identity facts
  extractedValue?: string;    // For identity facts
}

export const detectContext = (text: string): ContextType => {
  const lowerText = text.toLowerCase();
  let bestContext: ContextType = "general";
  let maxMatches = 0;

  for (const [context, keywords] of Object.entries(CONTEXT_KEYWORDS)) {
    if (context === "general") continue;
    
    const matches = keywords.filter(kw => lowerText.includes(kw)).length;
    if (matches > maxMatches) {
      maxMatches = matches;
      bestContext = context as ContextType;
    }
  }

  return bestContext;
};

export const detectMemoryIntent = (text: string): DetectionResult => {
  const lowerText = text.toLowerCase();
  const context = detectContext(text);
  
  // Check for identity statements
  const isIdentityStatement = IDENTITY_INDICATORS.some(indicator => 
    lowerText.includes(indicator)
  );
  
  // Check for knowledge statements
  const isKnowledgeStatement = KNOWLEDGE_INDICATORS.some(indicator => 
    lowerText.includes(indicator)
  );
  
  // Determine suggested layer
  let suggestedLayer: MemoryLayer = "experience"; // Default
  let confidence = 0.5;
  
  if (isIdentityStatement) {
    suggestedLayer = "identity";
    confidence = 0.8;
  } else if (isKnowledgeStatement) {
    suggestedLayer = "knowledge";
    confidence = 0.7;
  }
  
  // Try to extract key-value for identity facts
  let extractedKey: string | undefined;
  let extractedValue: string | undefined;
  
  if (isIdentityStatement) {
    const extraction = extractIdentityFact(text);
    extractedKey = extraction.key;
    extractedValue = extraction.value;
    if (extractedKey && extractedValue) {
      confidence = 0.9;
    }
  }
  
  return {
    context,
    suggestedLayer,
    confidence,
    isIdentityStatement,
    isKnowledgeStatement,
    extractedKey,
    extractedValue,
  };
};

// Extract key-value pairs from identity statements
const extractIdentityFact = (text: string): { key?: string; value?: string } => {
  const lowerText = text.toLowerCase();
  
  // Pattern: "I am [value]" or "I'm [value]"
  const amMatch = lowerText.match(/i(?:'m| am)\s+(?:a\s+)?(\w+)/);
  if (amMatch) {
    const value = amMatch[1];
    // Common identity values
    const dietaryValues = ["vegetarian", "vegan", "pescatarian"];
    const religionValues = ["christian", "muslim", "jewish", "buddhist", "hindu", "atheist"];
    
    if (dietaryValues.includes(value)) {
      return { key: "diet", value };
    }
    if (religionValues.includes(value)) {
      return { key: "religion", value };
    }
    // Generic trait
    return { key: "trait", value };
  }
  
  // Pattern: "My name is [value]" or "I'm [name]" or "I am [name]" (when name-like)
  const nameMatch = lowerText.match(/my name is\s+(\w+)/);
  if (nameMatch) {
    return { key: "name", value: nameMatch[1] };
  }
  
  // Pattern: "I'm [Name]" or "I am [Name]" - check for capitalized name in original text
  const nameMatch2 = text.match(/(?:I'm|I am)\s+([A-Z][a-z]+)(?:\s|,|\.|\!|$)/);
  if (nameMatch2) {
    return { key: "name", value: nameMatch2[1] };
  }
  
  // Pattern: "I don't eat [value]" or "I don't drink [value]"
  const dontMatch = lowerText.match(/i don't\s+(eat|drink)\s+(\w+)/);
  if (dontMatch) {
    return { key: `avoid_${dontMatch[1]}`, value: dontMatch[2] };
  }
  
  // Pattern: "I prefer [value]"
  const preferMatch = lowerText.match(/i prefer\s+(.+?)(?:\.|,|$)/);
  if (preferMatch) {
    return { key: "preference", value: preferMatch[1].trim() };
  }
  
  return {};
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
