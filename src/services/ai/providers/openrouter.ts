import type { AIInput, AIOutput } from "../types";
import { buildPrompt } from "./prompt";

export async function analyzeWithOpenRouter(input: AIInput): Promise<AIOutput> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set in .env.");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  let res: Response;
  try {
    res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer": "https://forzadj.ru",
        "X-Title": "ForzaDJ Bot",
      },
      body: JSON.stringify({
        model: "meta-llama/llama-3.1-8b-instruct:free",
        messages: [
          {
            role: "system",
            content:
              "You are a professional DJ and music classifier for the ForzaDJ platform. " +
              "Follow the classification rules exactly. " +
              "Return only valid JSON with no extra text.",
          },
          { role: "user", content: buildPrompt(input) },
        ],
        temperature: 0,
        max_tokens: 64,
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`OpenRouter request failed: HTTP ${res.status} — ${body}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenRouter returned an empty response.");

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("OpenRouter response did not contain valid JSON.");

  const parsed = JSON.parse(jsonMatch[0]) as AIOutput;
  return {
    genre: String(parsed.genre),
    mood: String(parsed.mood),
    version: String(parsed.version),
    rating: Number(parsed.rating),
  };
}
