import type { AIInput, AIOutput } from "./types";

// Placeholder AI provider. Does NOT call any external AI model yet.
// Returns mock values until a real model is wired in.
export async function analyzeTrack(_input: AIInput): Promise<AIOutput> {
  return {
    genre: "House",
    mood: "Primetime",
    version: "Extended",
    rating: 5,
  };
}
