import { Context } from "grammy";
import { unlink } from "fs/promises";
import { downloadTelegramFile } from "../services/telegram-download";
import { extractAudioMetadata, cleanTitle } from "../services/audio-metadata";
import { analyzeTrack } from "../services/ai/provider";
import { pendingStore } from "../services/pending";
import { getArtworkPath } from "../services/artwork";
import { buildPreviewText, buildPreviewKeyboard } from "./preview";
import type { AIOutput } from "../services/ai/types";

const AUDIO_EXTENSIONS = [".mp3", ".wav", ".flac", ".aiff"];
// Telegram Bot API hard limit for file downloads via getFile.
const MAX_TELEGRAM_FILE_SIZE = 20 * 1024 * 1024;

function isAudioFile(fileName: string | undefined, mimeType: string | undefined): boolean {
  const name = (fileName ?? "").toLowerCase();
  if (AUDIO_EXTENSIONS.some((ext) => name.endsWith(ext))) return true;
  return mimeType?.startsWith("audio/") ?? false;
}

export function createAudioHandler(token: string) {
  return async function handleAudio(
    ctx: Context,
    file: {
      file_id: string;
      file_size?: number;
      file_name?: string;
      mime_type?: string;
      // Telegram extracts these from audio files automatically
      performer?: string;
      title?: string;
    }
  ) {
    if (!isAudioFile(file.file_name, file.mime_type)) {
      await ctx.reply("Unsupported file type.");
      return;
    }

    if (file.file_size && file.file_size > MAX_TELEGRAM_FILE_SIZE) {
      await ctx.reply(
        `⚠️ File too large (${(file.file_size / 1024 / 1024).toFixed(1)} MB). ` +
          `Telegram Bot API only allows the bot to download files up to 20 MB.`,
      );
      return;
    }

    let downloaded;
    try {
      downloaded = await downloadTelegramFile(token, ctx.api, file);
    } catch (err) {
      console.error("[audio] download failed:", err);
      await ctx.reply(
        `⚠️ Failed to download the file from Telegram: ${err instanceof Error ? err.message : String(err)}`,
      );
      return;
    }
    if (!downloaded) {
      await ctx.reply("⚠️ Failed to download the file from Telegram.");
      return;
    }

    const { input: metadataInput } = await extractAudioMetadata(downloaded.savePath, file.file_name);

    // Telegram extracts performer/title from the audio file independently.
    // Use them as fallback when our ID3 parsing and filename parsing both fail.
    if (!metadataInput.artist && file.performer) {
      metadataInput.artist = file.performer;
    }
    if (!metadataInput.title && file.title) {
      metadataInput.title = cleanTitle(file.title);
    }

    let aiResult: AIOutput | null = null;
    let artworkPath: string | null = null;
    try {
      aiResult = await analyzeTrack(metadataInput);
      artworkPath = await getArtworkPath(aiResult.genre);
    } catch (err) {
      console.error("[AI] analysis failed:", err);
    }

    const chatId = ctx.chat?.id;
    if (chatId !== undefined) {
      // Sending a new track abandons any unpublished pending one — clean up
      // its temp file instead of leaking it on disk indefinitely.
      const previous = pendingStore.get(chatId);
      if (previous && previous.filePath !== downloaded.savePath) {
        await unlink(previous.filePath).catch(() => {});
      }
      const pub = {
        filePath: downloaded.savePath,
        fileName: downloaded.saveName,
        mimeType: file.mime_type ?? "application/octet-stream",
        metadataInput,
        aiResult,
        artworkPath,
      };
      pendingStore.set(chatId, pub);
      await ctx.reply(buildPreviewText(pub), { reply_markup: buildPreviewKeyboard() });
    }
  };
}
