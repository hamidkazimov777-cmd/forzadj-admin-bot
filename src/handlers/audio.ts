import { Context } from "grammy";
import { downloadTelegramFile } from "../services/telegram-download";
import { extractAudioMetadata } from "../services/audio-metadata";
import { analyzeTrack } from "../services/ai/provider";
import { pendingStore } from "../services/pending";
import { getArtworkPath } from "../services/artwork";
import { buildPreviewText, buildPreviewKeyboard } from "./preview";
import type { AIOutput } from "../services/ai/types";

const AUDIO_EXTENSIONS = [".mp3", ".wav", ".flac", ".aiff"];

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

    const downloaded = await downloadTelegramFile(token, ctx.api, file);
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
      metadataInput.title = file.title;
    }

    let aiResult: AIOutput | null = null;
    let artworkPath: string | null = null;
    try {
      aiResult = await analyzeTrack(metadataInput);
      artworkPath = await getArtworkPath(aiResult.genre);
    } catch {
      // aiResult stays null; preview still shown with edit/publish options
    }

    const chatId = ctx.chat?.id;
    if (chatId !== undefined) {
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
