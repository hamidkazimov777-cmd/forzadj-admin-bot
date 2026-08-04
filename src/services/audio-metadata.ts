import { parseFile } from "music-metadata";

// Extract metadata locally from the saved file and return a formatted block
export async function extractAudioMetadata(filePath: string): Promise<string> {
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
    return (
      "📋 Metadata\n\n" +
      `Artist: ${fmt(common.artist)}\n` +
      `Title: ${fmt(common.title)}\n` +
      `Album: ${fmt(common.album)}\n` +
      `Year: ${fmt(common.year)}\n` +
      `Duration: ${seconds}\n` +
      `Bitrate: ${kbps}\n` +
      `Sample rate: ${fmt(format.sampleRate)} Hz\n` +
      `Channels: ${fmt(format.numberOfChannels)}\n` +
      `Codec: ${fmt(format.codec)}\n` +
      `Container: ${fmt(format.container)}\n` +
      `ISRC: ${fmt(common.isrc)}`
    );
  } catch {
    return "Metadata: unavailable (could not parse file)";
  }
}
