import { getAIProvider } from "../../config/ai";
import { analyzeWithKimi } from "./providers/kimi";
import { analyzeWithGroq } from "./providers/groq";
import type { AIInput, AIOutput } from "./types";

// Mock provider: no external calls, returns fixed values.
async function analyzeWithMock(_input: AIInput): Promise<AIOutput> {
  return {
    genre: "House",
    mood: "Primetime",
    version: "Extended",
    rating: 5,
  };
}

// Selects the AI provider based on the AI_PROVIDER environment variable.
export async function analyzeTrack(input: AIInput): Promise<AIOutput> {
  const provider = getAIProvider();
  switch (provider) {
    case "mock":
      return analyzeWithMock(input);
    case "kimi":
      return analyzeWithKimi(input);
    case "groq":
      return analyzeWithGroq(input);
  }
}
