import type { AIInput, AIOutput } from "../types";

// Kimi provider via TokenRouter (OpenAI-compatible chat completions API).
// Not yet wired into analyzeTrack() — implemented only.
const PROMPT = `Reply only with valid JSON.

The expected JSON format is:
{
  "genre": "House",
  "mood": "Primetime",
  "version": "Extended",
  "rating": 5
}`;

export async function analyzeWithKimi(_input: AIInput): Promise<AIOutput> {
  const apiKey = process.env.TOKENROUTER_API_KEY;
  const baseUrl = process.env.TOKENROUTER_BASE_URL;
  const model = process.env.TOKENROUTER_MODEL;

  if (!apiKey || !baseUrl || !model) {
    throw new Error(
      "TokenRouter is not configured. Set TOKENROUTER_API_KEY, " +
        "TOKENROUTER_BASE_URL and TOKENROUTER_MODEL in your .env file."
    );
  }

  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: PROMPT }],
      temperature: 0,
    }),
  });

  if (!res.ok) {
    throw new Error(`Kimi provider request failed: HTTP ${res.status}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Kimi provider returned an empty response.");
  }

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Kimi provider response did not contain valid JSON.");
  }

  const parsed = JSON.parse(jsonMatch[0]) as AIOutput;
  return {
    genre: String(parsed.genre),
    mood: String(parsed.mood),
    version: String(parsed.version),
    rating: Number(parsed.rating),
  };
}
