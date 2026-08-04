import type { AIInput } from "../types";

export function buildPrompt(input: AIInput): string {
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
