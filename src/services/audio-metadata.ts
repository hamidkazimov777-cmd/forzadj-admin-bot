import { parseFile } from "music-metadata";
import type { AIInput } from "./ai/types";

export interface AudioMetadataResult {
  block: string;
  input: AIInput;
}

export async function extractAudioMetadata(filePath: string): Promise<AudioMetadataResult> {
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

    const block =
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
      `ISRC: ${fmt(common.isrc)}`;

    const input: AIInput = {};
    if (common.artist) input.artist = common.artist;
    if (common.title) input.title = common.title;
    if (common.album) input.album = common.album;
    if (common.year !== undefined) input.year = common.year;
    if (format.duration !== undefined) input.duration = format.duration;
    if (format.bitrate !== undefined) input.bitrate = format.bitrate;
    if (format.sampleRate !== undefined) input.sampleRate = format.sampleRate;
    if (format.numberOfChannels !== undefined) input.channels = format.numberOfChannels;
    if (format.codec) input.codec = format.codec;
    if (format.container) input.format = format.container;
    if (common.genre?.[0]) input.embeddedGenre = common.genre[0];

    return { block, input };
  } catch {
    return {
      block: "Metadata: unavailable (could not parse file)",
      input: {},
    };
  }
}
