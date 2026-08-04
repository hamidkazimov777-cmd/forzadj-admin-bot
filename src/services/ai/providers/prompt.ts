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
  if (input.embeddedGenre) lines.push(`Embedded genre tag: ${input.embeddedGenre}`);

  const trackInfo = lines.length > 0 ? `Track info:\n${lines.join("\n")}\n\n` : "";

  return (
    `${trackInfo}` +
    `You are a DJ music classifier. Classify this track using ONLY the values listed below.\n\n` +

    `VERSION RULES (check title/filename first, these are definitive):\n` +
    `- Title/filename contains "remix", "rmx", "rework" → "Remix"\n` +
    `- Title/filename contains "extended", "ext mix", "club mix" → "Extended"\n` +
    `- Title/filename contains "mashup", "mash up", "mash-up" → "Mashup"\n` +
    `- Otherwise → "Original"\n\n` +

    `GENRE (choose exactly one — be specific, avoid "Open Format" unless truly unclassifiable):\n` +
    `Afro House — African percussion, deep groove, tribal elements\n` +
    `Baile Funk — Brazilian funk, aggressive bass, MC vocals\n` +
    `Bass House — heavy distorted bass, aggressive drops, UK/US club\n` +
    `Breaks — breakbeat rhythm, syncopated drums, energetic\n` +
    `EDM — big-room, festival anthems, mainstream electronic\n` +
    `Garage — UK garage, 2-step rhythm, soulful vocals, 130 BPM\n` +
    `Hip-Hop — rap vocals, boom-bap or trap drums, hip-hop culture\n` +
    `House — classic house, 4/4 kick, soulful or club-oriented\n` +
    `Jersey Club — Jersey/Chicago footwork, fast hi-hats, 130-160 BPM\n` +
    `Open Format — truly mixed/unclassifiable, does not fit any above genre\n` +
    `Pop — mainstream pop production, vocals-led, radio-friendly\n` +
    `Rus — Russian-language pop/rap/chanson/electronic\n` +
    `Tech House — techno + house hybrid, punchy kicks, minimal groove\n\n` +

    `MOOD (choose exactly one):\n` +
    `Warm Up — slower, atmospheric, set opener (under 124 BPM or low energy)\n` +
    `Prime Time — peak hour, high energy, main floor\n` +
    `After Party — late night, darker, deeper vibes\n\n` +

    `RATING: integer 1–5 based on production quality and DJ usability\n` +
    `1=poor, 2=below average, 3=decent, 4=good, 5=excellent\n\n` +

    `Return ONLY valid JSON, no markdown, no explanation:\n` +
    `{"genre":"House","mood":"Prime Time","version":"Remix","rating":4}`
  );
}
