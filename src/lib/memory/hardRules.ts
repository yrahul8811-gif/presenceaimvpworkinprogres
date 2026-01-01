// Hard rules for memory routing - certainty-based overrides
// These rules take precedence over ML classification

import type { Layer, Decision, RoutingResult } from "./types";

// Helper to create forced routing result
function force(layer: Decision, reason: string): RoutingResult {
  return {
    decision: layer,
    confidence: 1.0,
    probabilities: { IMM: 0, EMM: 0, KMM: 0 },
    source: "RULE",
    reasoning: reason,
  };
}

// Identity patterns - VERY strict, only explicit declarations
const IDENTITY_PATTERNS: RegExp[] = [
  /^my name is /i,
  /^i am (a|an) /i,
  /^i'm (a|an) /i,
  /^i (do not|don't) eat /i,
  /^i eat only /i,
  /^my (diet|religion|language|gender) is /i,
  /^i am (\w+)$/i,                    // "I am John"
  /^i'm (\w+)$/i,                     // "I'm vegetarian"
  /^call me /i,                       // "Call me Alex"
  /^i prefer to be called /i,
  /^i identify as /i,
  /^i am allergic to /i,
  /^i'm allergic to /i,
  /^i have a (food )?allergy/i,
  /^never (call|refer to) me/i,
];

// Correction patterns - user is updating identity
const CORRECTION_PATTERNS: RegExp[] = [
  /^actually[, ]/i,
  /^correction[: ]/i,
  /^i meant /i,
  /no, that's wrong/i,
  /^that's not right/i,
  /^wait, i'm actually/i,
  /^i changed my /i,
  /^i now /i,
];

// Command patterns
const COMMAND_PATTERNS = {
  recall: /^\/recall /i,
  forget: /^\/forget /i,
  remember: /^\/remember /i,
};

// Safety patterns - should not be stored
const SAFETY_BLOCKLIST = [
  "kill yourself",
  "hurt you",
  "fuck you",
  "i hate you",
  "die",
];

// Knowledge indicators
const KNOWLEDGE_INDICATORS = [
  /^i know (how to|about) /i,
  /^i learned /i,
  /^i understand /i,
  /^i can (code|program|write|build|create|design|speak) /i,
  /^i'm good at /i,
  /^i'm skilled in /i,
  /^i specialize in /i,
  /^i work with /i,
  /^i have experience in /i,
];

export function applyHardRules(text: string): RoutingResult | null {
  const t = text.trim();
  const tLower = t.toLowerCase();

  // 1. Check commands first
  if (COMMAND_PATTERNS.recall.test(t)) {
    return force("EMM", "Explicit recall command");
  }
  if (COMMAND_PATTERNS.forget.test(t)) {
    return force("EMM", "Explicit forget command");
  }
  if (COMMAND_PATTERNS.remember.test(t)) {
    return force("IMM", "Explicit remember command");
  }

  // 2. Safety check
  if (SAFETY_BLOCKLIST.some(b => tLower.includes(b))) {
    return force("NONE", "Safety trigger - content blocked");
  }

  // 3. Identity patterns (strict)
  if (IDENTITY_PATTERNS.some(p => p.test(t))) {
    return force("IMM", "Explicit identity declaration");
  }

  // 4. Correction patterns (update identity)
  if (CORRECTION_PATTERNS.some(p => p.test(t))) {
    return force("IMM", "Explicit correction - identity update");
  }

  // 5. Knowledge patterns
  if (KNOWLEDGE_INDICATORS.some(p => p.test(t))) {
    return force("KMM", "Explicit knowledge/skill declaration");
  }

  // No hard rule matched - defer to ML
  return null;
}

// Extract key-value pairs from identity statements
export function extractIdentityFact(text: string): { key?: string; value?: string } {
  const t = text.trim();
  const tLower = t.toLowerCase();

  // "My name is X"
  const nameMatch = tLower.match(/my name is\s+(\w+)/);
  if (nameMatch) {
    return { key: "name", value: nameMatch[1] };
  }

  // "I'm X" or "I am X" at end of sentence
  const amMatch = t.match(/(?:I'm|I am)\s+([A-Z][a-z]+)(?:\s*[.,!])?$/);
  if (amMatch) {
    return { key: "name", value: amMatch[1] };
  }

  // "I am a/an X" (trait/role)
  const traitMatch = tLower.match(/i(?:'m| am)\s+(?:a|an)\s+(\w+)/);
  if (traitMatch) {
    const value = traitMatch[1];
    const dietaryValues = ["vegetarian", "vegan", "pescatarian", "flexitarian"];
    const religionValues = ["christian", "muslim", "jewish", "buddhist", "hindu", "atheist", "agnostic"];
    
    if (dietaryValues.includes(value)) {
      return { key: "diet", value };
    }
    if (religionValues.includes(value)) {
      return { key: "religion", value };
    }
    return { key: "trait", value };
  }

  // "I don't eat/drink X"
  const dontMatch = tLower.match(/i (?:don't|do not)\s+(eat|drink)\s+(\w+)/);
  if (dontMatch) {
    return { key: `avoid_${dontMatch[1]}`, value: dontMatch[2] };
  }

  // "I am allergic to X"
  const allergyMatch = tLower.match(/i(?:'m| am) allergic to\s+(.+?)(?:\.|,|$)/);
  if (allergyMatch) {
    return { key: "allergy", value: allergyMatch[1].trim() };
  }

  // "Call me X"
  const callMatch = t.match(/call me\s+(\w+)/i);
  if (callMatch) {
    return { key: "preferred_name", value: callMatch[1] };
  }

  // "My diet/religion/language is X"
  const myMatch = tLower.match(/my (diet|religion|language|gender) is\s+(\w+)/);
  if (myMatch) {
    return { key: myMatch[1], value: myMatch[2] };
  }

  return {};
}
