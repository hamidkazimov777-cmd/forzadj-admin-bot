import type { AIInput } from "../types";

export function buildPrompt(input: AIInput): string {
  const lines: string[] = [];
  if (input.artist) lines.push(`Artist: ${input.artist}`);
  if (input.title) lines.push(`Title: ${input.title}`);
  if (input.remixer) lines.push(`Remixer: ${input.remixer}`);
  if (input.album) lines.push(`Album: ${input.album}`);
  if (input.year !== undefined) lines.push(`Year: ${input.year}`);
  if (input.bpm !== undefined) lines.push(`BPM (from file): ${input.bpm}`);
  if (input.duration !== undefined) lines.push(`Duration: ${input.duration.toFixed(1)} s`);
  if (input.bitrate !== undefined) lines.push(`Bitrate: ${Math.round(input.bitrate / 1000)} kbps`);
  if (input.codec) lines.push(`Codec: ${input.codec}`);
  if (input.embeddedGenre) lines.push(`Embedded genre tag: ${input.embeddedGenre}`);

  const trackInfo = lines.length > 0 ? `Track info:\n${lines.join("\n")}\n\n` : "";
  
  let hints = "";
  if (input.remixer) {
    hints += `CRITICAL: This is a remix by ${input.remixer}. Ignore the original artist's typical style. Base your genre classification strictly on what ${input.remixer} usually produces.\n`;
  }
  if (input.bpm) {
    if (input.bpm >= 118 && input.bpm <= 124) {
      hints += `BPM Hint: 118-124 BPM strongly suggests Afro House, Deep House, or House. It is rarely Bass House.\n`;
    } else if (input.bpm >= 125 && input.bpm <= 129) {
      hints += `BPM Hint: 125-129 BPM is typical for Tech House, Bass House, and EDM.\n`;
    } else if (input.bpm >= 130) {
      hints += `BPM Hint: >=130 BPM is ALMOST NEVER Tech House or Afro House. Strongly consider Garage, Breaks, Bass House, or Jersey Club.\n`;
    }
  }
  const tTitle = input.title?.toLowerCase() || "";
  if (tTitle.includes("amapiano")) hints += `Title Hint: 'Amapiano' strongly implies Afro House.\n`;
  if (tTitle.includes("festival")) hints += `Title Hint: 'Festival' usually implies EDM or Big Room.\n`;
  if (tTitle.includes("ukg") || tTitle.includes("garage")) hints += `Title Hint: 'UKG' or 'Garage' strictly means Garage.\n`;
  
  if (hints) hints = `System Hints:\n${hints}\n`;

  return (
    `${trackInfo}` +
    `${hints}` +
    `You are an expert DJ and music curator for ForzaDJ, a professional DJ pool. ` +
    `Use your deep knowledge of electronic music, artists, labels, club culture, and the global DJ industry to classify this track. ` +
    `If the artist is known, reason from their actual style, label, and typical releases — do not default to generic answers.\n\n` +

    `VERSION (check title keywords — this is deterministic, not subjective):\n` +
    `- Contains remix / rmx / rework / bootleg / edit (by someone other than original artist) → "Remix"\n` +
    `- Contains extended / ext / club mix / long version / festival mix → "Extended"\n` +
    `- Contains mashup / mash-up / mash up → "Mashup"\n` +
    `- Contains vip / vip mix / vip edit → "Remix"\n` +
    `- Contains instrumental / acapella / dub → "Remix"\n` +
    `- Anything else (original mix, radio edit, no suffix) → "Original"\n\n` +

    `GENRE (choose exactly one — be specific, use artist/label knowledge):\n` +
    `Afro House — African percussion, tribal elements, deep groove, 118-123 BPM, artists: Keinemusik, Black Coffee. labels: Afro Nation\n` +
    `Baile Funk — Brazilian funk, MC vocals, aggressive bass, 150–170 BPM\n` +
    `Bass House — heavy distorted bass, aggressive drops, 124-130 BPM, artists: Knock2, Habstrakt. labels: Night Bass\n` +
    `Breaks — breakbeat rhythm, syncopated drums, 120–140 BPM\n` +
    `EDM — big-room festival anthems, mainstream drops, 126-130 BPM. labels: Spinnin, Revealed\n` +
    `Garage — UK garage, 2-step, soulful vocals, ~130-140+ BPM, swung beat, artists: Disclosure, Sammy Virji. labels: Black Butter\n` +
    `Hip-Hop — rap vocals, boom-bap or trap, hip-hop culture, 70–100 BPM\n` +
    `House — classic/soulful/deep house, 4/4 kick, 120–128 BPM, labels: Defected, Toolroom\n` +
    `Jersey Club — Jersey/Chicago footwork, fast hi-hats, 130–160 BPM, labels: Club Glow\n` +
    `Open Format — truly mixed/unclassifiable, use only as last resort\n` +
    `Pop — mainstream pop, vocals-led, radio-friendly, crossover\n` +
    `Rus — Russian-language pop/rap/chanson/electronic\n` +
    `Tech House — techno+house hybrid, punchy kicks, minimal groove, 124–128 BPM, artists: Fisher, James Hype, Chris Lake. labels: Drumcode, Repopulate Mars\n\n` +

    `MOOD — think about WHERE and WHEN a DJ would play this track in a set:\n` +
    `Warm Up — opening set, background atmosphere, crowd is arriving, low intensity. ` +
    `Typical: deep/minimal tracks, smooth slow builds, instrumental ambient. ` +
    `NOT automatically low BPM — a slow Hip-Hop banger can still be Prime Time.\n` +
    `Prime Time — peak hour, main floor, high energy, crowd is going. ` +
    `Most commercial releases, festival tracks, club hits. ` +
    `This is NOT the default — only choose it when the track genuinely fits peak-hour energy.\n` +
    `After Party — late night, dark, underground, hypnotic, minimal, closing set. ` +
    `Typical: dark techno-influenced, minimal, trippy, late-night deep house.\n` +
    `Use BPM as one signal but always combine with genre and vibe — a 90 BPM Hip-Hop anthem can be Prime Time, ` +
    `a 160 BPM Dubstep can be Prime Time too. Genre and energy matter more than raw BPM.\n\n` +

    `RATING — club potential and DJ demand, not audio file quality:\n` +
    `5 = Instant dancefloor hit, high DJ demand, would chart on Beatport/Traxsource\n` +
    `4 = Strong club track, professional quality, fits main floor sets\n` +
    `3 = Decent track, functional for sets but not a standout\n` +
    `2 = Niche appeal, limited DJ usability, filler\n` +
    `1 = Not DJ-usable (wrong vibe, poor structure, zero dancefloor potential)\n` +
    `Be honest and use the full range. Most tracks are 3–4. Reserve 5 for genuinely exceptional releases.\n\n` +

    `IMPORTANT: Do not default to Prime Time for mood or 4 for rating when uncertain. ` +
    `Make a confident decision based on all available context. ` +
    `If embedded genre tag is present, treat it as strong evidence.\n\n` +

    `Return ONLY valid JSON, no markdown, no explanation:\n` +
    `{"genre":"House","mood":"Prime Time","version":"Original","rating":4}`
  );
}
