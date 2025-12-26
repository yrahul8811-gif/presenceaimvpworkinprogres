// Memory System Types - Three Layer Architecture

export type MemoryLayer = "identity" | "experience" | "knowledge";
export type ContextType = "general" | "family" | "work" | "college" | "personal" | "health" | "hobby";

// Layer 1: Identity Memory - Exact facts, never use vectors
export interface IdentityFact {
  id: string;
  key: string;                    // e.g., "diet", "name", "religion"
  value: string;                  // e.g., "vegetarian", "John", "Buddhist"
  category: string;               // e.g., "preference", "trait", "boundary"
  confidence: number;             // 0-1, higher = more certain
  confirmationCount: number;      // How many times confirmed
  lastConfirmed: string;          // ISO timestamp
  createdAt: string;              // ISO timestamp
  source: "explicit" | "inferred"; // User said directly vs inferred
}

// Layer 2: Experience Memory - Hybrid DB + Vector
export interface ExperienceEntry {
  id: string;
  content: string;
  context: ContextType;
  timestamp: string;
  importance: number;             // 0-1, subject to decay
  originalImportance: number;     // For decay calculation
  role: "user" | "assistant";
  embedding?: number[];           // For semantic search
  metadata?: Record<string, unknown>;
}

// Layer 3: Knowledge Memory - Vector-first with metadata
export interface KnowledgeEntry {
  id: string;
  content: string;
  category: string;               // e.g., "skill", "concept", "fact"
  embedding: number[];
  confidence: number;
  reinforcementCount: number;     // How often this was referenced
  timestamp: string;
  metadata?: Record<string, unknown>;
}

// Retrieval result with layer info
export interface MemoryResult {
  layer: MemoryLayer;
  content: string;
  confidence: number;
  similarity?: number;            // Only for vector results
  timestamp: string;
  metadata?: Record<string, unknown>;
}

// Memory write request
export interface MemoryWriteRequest {
  content: string;
  role: "user" | "assistant";
  context?: ContextType;
  forceLayer?: MemoryLayer;       // Override automatic routing
}

// Conflict info
export interface MemoryConflict {
  existingFact: IdentityFact;
  newValue: string;
  suggestedAction: "ask_user" | "update" | "ignore";
}
