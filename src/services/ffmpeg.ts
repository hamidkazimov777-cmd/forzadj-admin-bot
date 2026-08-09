import { execFile } from "child_process";
import { promisify } from "util";
import { stat, unlink } from "fs/promises";

const execFileAsync = promisify(execFile);

export interface AudioProbeResult {
  codec: string;
  format: string;
  sizeBytes: number;
}

export async function probeAudio(filePath: string): Promise<AudioProbeResult> {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v", "error",
    "-select_streams", "a:0",
    "-show_entries", "stream=codec_name:format=format_name",
    "-of", "json",
    filePath
  ]);
  
  const data = JSON.parse(stdout);
  const codec = data.streams?.[0]?.codec_name ?? "unknown";
  const format = data.format?.format_name ?? "unknown";
  
  const fileStat = await stat(filePath);
  
  return {
    codec,
    format,
    sizeBytes: fileStat.size,
  };
}

/**
 * Validates the actual codec using ffprobe.
 * If it's a lossless format (WAV, FLAC, AIFF), converts to 320kbps MP3.
 * Only deletes the original file after successful conversion and validation of the output.
 * Returns the path to the MP3 file (or the original if skipped).
 */
export async function convertToMp3IfNeeded(filePath: string): Promise<string> {
  const probe = await probeAudio(filePath);
  
  // Identifying common lossless audio codecs and container formats
  const LOSSLESS_CODECS = ["pcm_s16le", "pcm_s24le", "pcm_s32le", "pcm_f32le", "alac", "flac", "wavpack", "pcm_s16be", "pcm_s24be"];
  const LOSSLESS_FORMATS = ["wav", "flac", "aiff"];
  
  const isLossless = LOSSLESS_CODECS.includes(probe.codec) || LOSSLESS_FORMATS.some(f => probe.format.includes(f));
  
  if (!isLossless) {
    return filePath; // Already lossy or unrecognized, leave as is
  }
  
  const startTime = Date.now();
  let outPath = filePath.includes('.') ? filePath.replace(/\.[^.]+$/, ".mp3") : `${filePath}.mp3`;
  if (outPath === filePath) {
    outPath = `${filePath}_converted.mp3`; // Fallback if extension was already .mp3 but contained WAV
  }
  
  try {
    await execFileAsync("ffmpeg", [
      "-y",
      "-i", filePath,
      "-map_metadata", "0",
      "-id3v2_version", "3",
      "-c:a", "libmp3lame",
      "-b:a", "320k",
      outPath
    ]);
  } catch (err) {
    console.error(`[ffmpeg] Conversion failed for ${filePath}:`, err);
    throw err;
  }
  
  // Validate output
  const outProbe = await probeAudio(outPath);
  if (outProbe.codec !== "mp3") {
    // Clean up the failed output
    await unlink(outPath).catch(() => {});
    throw new Error(`[ffmpeg] Output validation failed: codec is ${outProbe.codec} instead of mp3`);
  }
  
  const durationMs = Date.now() - startTime;
  
  console.log(
    `[ffmpeg] Converted ${probe.codec}/${probe.format} ` +
    `(${(probe.sizeBytes / 1024 / 1024).toFixed(2)} MB) to MP3 ` +
    `(${(outProbe.sizeBytes / 1024 / 1024).toFixed(2)} MB) in ${durationMs}ms`
  );
  
  // Safe to delete original since conversion and validation succeeded
  await unlink(filePath).catch(e => console.error(`[ffmpeg] Failed to delete original file:`, e));
  
  return outPath;
}
