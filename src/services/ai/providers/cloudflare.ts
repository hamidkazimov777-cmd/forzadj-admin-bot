import type { AIInput, AIOutput } from "../types";
import { buildPrompt } from "./prompt";
export async function analyzeWithCloudflare(input: AIInput): Promise<AIOutput> {
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!apiToken) throw new Error("CLOUDFLARE_API_TOKEN is not set.");
  if (!accountId) throw new Error("CLOUDFLARE_ACCOUNT_ID is not set.");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  let res: Response;
  try {
    res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/meta/llama-3.1-8b-instruct`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiToken}`,
        },
        body: JSON.stringify({
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
          max_tokens: 64,
          temperature: 0,
        }),
        signal: controller.signal,
      }
    );
  } finally {
    clearTimeout(timeout);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Cloudflare AI request failed: HTTP ${res.status} — ${body}`);
  }
  const data = (await res.json()) as {
    result?: {
      response?: unknown;
      choices?: { message?: { content?: string } }[];
    };
  };
  // Cloudflare Workers AI менял форму ответа: раньше result.response был
  // строкой, теперь может быть уже разобранным объектом либо лежать в
  // choices[].message.content (OpenAI-совместимый формат).
  const raw = data.result?.response;
  let parsed: AIOutput;
  if (raw && typeof raw === "object") {
    parsed = raw as AIOutput;
  } else {
    const content =
      (typeof raw === "string" ? raw : undefined) ??
      data.result?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content) {
      throw new Error("Cloudflare AI returned an empty response.");
    }
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch)
      throw new Error("Cloudflare AI response did not contain valid JSON.");
    parsed = JSON.parse(jsonMatch[0]) as AIOutput;
  }
  return {
    genre: String(parsed.genre),
    mood: String(parsed.mood),
    version: String(parsed.version),
    rating: Number(parsed.rating),
  };
}
