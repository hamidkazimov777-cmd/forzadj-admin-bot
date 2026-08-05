import type { AIInput, AIOutput } from "../types";
import { buildPrompt } from "./prompt";

export async function analyzeWithGemini(input: AIInput): Promise<AIOutput> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set in .env.");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  let res: Response;
  try {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: buildPrompt(input) }] }],
          generationConfig: { temperature: 0, maxOutputTokens: 64 },
          systemInstruction: {
            parts: [{
              text: "You are a professional DJ and music classifier for the ForzaDJ platform. Follow the classification rules exactly. Return only valid JSON with no extra text.",
            }],
          },
        }),
        signal: controller.signal,
      }
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Gemini request failed: HTTP ${res.status} — ${body}`);
  }

  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!content) throw new Error("Gemini returned an empty response.");

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Gemini response did not contain valid JSON.");

  const parsed = JSON.parse(jsonMatch[0]) as AIOutput;
  return {
    genre: String(parsed.genre),
    mood: String(parsed.mood),
    version: String(parsed.version),
    rating: Number(parsed.rating),
  };
}
