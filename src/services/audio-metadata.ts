import { parseFile } from "music-metadata";
import type { AIInput } from "./ai/types";

export interface AudioMetadataResult {
  block: string;
  input: AIInput;
}

// Third alternative catches bare service terms at string end (no brackets/dashes).
// These are missed when the file uses underscores instead of spaces, because the
// underscore (\w) blocks \b word boundaries — fixed by normalizing before matching.
const DJ_SERVICE_TAGS =
  /\s*[\(\[][^\)\]]*\b(intro|outro|muzvizor|radio\s*edit|club\s*edit)\b[^\)\]]*[\)\]]|\s*[-–—]+\s*\b(muzvizor\s+)?(intro|outro|muzvizor)\b\s*$|\s+\b(muzvizor(?:\s+(?:intro|outro))?|intro|outro)\b\s*$/gi;

export function cleanTitle(title: string): string {
  // Run twice: first pass may uncover a second tag once the outer one is stripped
  // (e.g. "Song Muzvizor Intro" → "Song Muzvizor" → "Song").
  let cleaned = title.replace(DJ_SERVICE_TAGS, "").trim().replace(/\s+/g, " ");
  cleaned = cleaned.replace(DJ_SERVICE_TAGS, "").trim().replace(/\s+/g, " ");
  return cleaned || title;
}

function parseArtistTitle(fileName: string): { artist?: string; title?: string } {
  // Normalize underscores to spaces (common in Beatport/Traxsource filenames) and
  // collapse any runs of whitespace, then strip the extension.
  const base = fileName
    .replace(/\.[^.]+$/, "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Standard "Artist - Title" separator.
  const dashIdx = base.indexOf(" - ");
  if (dashIdx !== -1) {
    return {
      artist: base.slice(0, dashIdx).trim(),
      title: base.slice(dashIdx + 3).trim(),
    };
  }

  // No separator: try comma-based artist detection.
  // Convention: artist names are Title Case, title words are lowercase.
  // "Aaron Hibell, Alex Wann set me free Extended Version" →
  //   artist: "Aaron Hibell, Alex Wann"  title: "Set me free Extended Version"
  const commaIdx = base.indexOf(",");
  if (commaIdx !== -1) {
    const beforeComma = base.slice(0, commaIdx).trim();
    const words = base.slice(commaIdx + 1).trim().split(" ");
    const titleStart = words.findIndex((w) => /^[a-z]/.test(w));
    if (titleStart > 0) {
      const artist = `${beforeComma}, ${words.slice(0, titleStart).join(" ")}`.trim();
      const titleWords = words.slice(titleStart).join(" ");
      return {
        artist,
        title: titleWords.charAt(0).toUpperCase() + titleWords.slice(1),
      };
    }
  }

  // Fallback: whole normalized string as title (at least spaces are correct).
  return { title: base };
}

export async function extractAudioMetadata(
  filePath: string,
  originalFileName?: string,
): Promise<AudioMetadataResult> {
  try {
    const meta = await parseFile(filePath);
    const { common, format } = meta;
    const fmt = (v: unknown) =>
      v === undefined || v === null || v === "" ? "n/a" : String(v);
    const seconds =
      format.duration !== undefined
        ? `${format.duration.toFixed(1)} s`
        : "n/a";
    const kbps =
      format.bitrate !== undefined
        ? `${Math.round(format.bitrate / 1000)} kbps`
        : "n/a";

    // Fall back to filename parsing when ID3 artist tag is missing.
    // Many DJ tracks have an ID3 title but no artist — so check artist only.
    const fallback =
      !common.artist && originalFileName
        ? parseArtistTitle(originalFileName)
        : {};
    const artist = common.artist || fallback.artist;
    // When artist came from filename, the ID3 title often contains the full
    // "Artist - Title" string (same as the filename). Prefer the filename-parsed
    // title in that case to avoid the artist name appearing inside the title.
    const title = fallback.artist
      ? (fallback.title || common.title)
      : (common.title || fallback.title);

    const block =
      "📋 Metadata\n\n" +
      `Artist: ${fmt(artist)}\n` +
      `Title: ${fmt(title)}\n` +
      `Album: ${fmt(common.album)}\n` +
      `Year: ${fmt(common.year)}\n` +
      `Duration: ${seconds}\n` +
      `Bitrate: ${kbps}\n` +
      `Sample rate: ${fmt(format.sampleRate)} Hz\n` +
      `Channels: ${fmt(format.numberOfChannels)}\n` +
      `Codec: ${fmt(format.codec)}\n` +
      `Container: ${fmt(format.container)}\n` +
      `ISRC: ${fmt(common.isrc)}`;

    const input: AIInput = {};
    if (artist) input.artist = artist;
    if (title) input.title = cleanTitle(title);
    if (common.album) input.album = common.album;
    if (common.year !== undefined) input.year = common.year;
    if (format.duration !== undefined) input.duration = format.duration;
    if (format.bitrate !== undefined) input.bitrate = format.bitrate;
    if (format.sampleRate !== undefined) input.sampleRate = format.sampleRate;
    if (format.numberOfChannels !== undefined) input.channels = format.numberOfChannels;
    if (format.codec) input.codec = format.codec;
    if (format.container) input.format = format.container;
    if (common.genre?.[0]) input.embeddedGenre = common.genre[0];
    if (common.bpm) input.bpm = Math.round(common.bpm);

    return { block, input };
  } catch {
    return {
      block: "Metadata: unavailable (could not parse file)",
      input: {},
    };
  }
}
