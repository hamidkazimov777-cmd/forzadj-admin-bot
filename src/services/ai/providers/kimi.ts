import type { AIInput, AIOutput } from "../types";

function buildPrompt(input: AIInput): string {
  const lines: string[] = [];
  if (input.artist) lines.push(`Artist: ${input.artist}`);
  if (input.title) lines.push(`Title: ${input.title}`);
  if (input.album) lines.push(`Album: ${input.album}`);
  if (input.year !== undefined) lines.push(`Year: ${input.year}`);
  if (input.duration !== undefined) lines.push(`Duration: ${input.duration.toFixed(1)} s`);
  if (input.bitrate !== undefined) lines.push(`Bitrate: ${Math.round(input.bitrate / 1000)} kbps`);
  if (input.codec) lines.push(`Codec: ${input.codec}`);
  if (input.format) lines.push(`Format: ${input.format}`);
  if (input.embeddedGenre) lines.push(`Embedded genre tag: ${input.embeddedGenre}`);

  const trackInfo = lines.length > 0 ? `Track info:\n${lines.join("\n")}\n\n` : "";

  return (
    `${trackInfo}` +
    `Classify this DJ track using ONLY the values listed below.\n\n` +
    `Genres (choose exactly one):\n` +
    `Afro House, Baile Funk, Bass House, Breaks, EDM, Garage, Hip-Hop, House, Jersey Club, Open Format, Pop, Rus, Tech House\n\n` +
    `Mood (choose exactly one):\n` +
    `Warm Up, Prime Time, After Party\n\n` +
    `Version (choose exactly one):\n` +
    `Original, Extended, Remix, Mashup\n\n` +
    `Rating: integer from 1 to 5.\n\n` +
    `Rules:\n` +
    `- Never invent values outside the lists above.\n` +
    `- If genre cannot be determined with sufficient confidence, use "Open Format".\n` +
    `- Return ONLY valid JSON. No Markdown, no explanation, no comments.\n\n` +
    `Example: {"genre":"House","mood":"Prime Time","version":"Extended","rating":5}`
  );
}

export async function analyzeWithKimi(input: AIInput): Promise<AIOutput> {
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
      messages: [{ role: "user", content: buildPrompt(input) }],
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
