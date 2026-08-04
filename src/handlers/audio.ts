import { Context, InlineKeyboard } from "grammy";
import { downloadTelegramFile } from "../services/telegram-download";
import { extractAudioMetadata } from "../services/audio-metadata";
import { analyzeTrack } from "../services/ai/provider";

const AUDIO_EXTENSIONS = [".mp3", ".wav", ".flac", ".aiff"];

function isAudioFile(fileName: string | undefined, mimeType: string | undefined): boolean {
  const name = (fileName ?? "").toLowerCase();
  if (AUDIO_EXTENSIONS.some((ext) => name.endsWith(ext))) return true;
  return mimeType?.startsWith("audio/") ?? false;
}

function ratingStars(n: number): string {
  const filled = Math.min(5, Math.max(1, Math.round(n)));
  return "★".repeat(filled) + "☆".repeat(5 - filled);
}

export function createAudioHandler(token: string) {
  return async function handleAudio(
    ctx: Context,
    file: { file_id: string; file_size?: number; file_name?: string; mime_type?: string }
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

    const { block: metadataBlock, input: metadataInput } = await extractAudioMetadata(downloaded.savePath);

    // Replace the internal "📋 Metadata" header with the new "📀 Metadata" section header.
    const METADATA_HEADER = "📋 Metadata\n\n";
    const metadataBody = metadataBlock.startsWith(METADATA_HEADER)
      ? metadataBlock.slice(METADATA_HEADER.length)
      : metadataBlock;

    let aiSection: string;
    try {
      const ai = await analyzeTrack(metadataInput);
      aiSection =
        "🤖 AI Analysis\n\n" +
        `Genre: ${ai.genre}\n` +
        `Mood: ${ai.mood}\n` +
        `Version: ${ai.version}\n` +
        `Rating: ${ratingStars(ai.rating)} (${ai.rating}/5)`;
    } catch {
      aiSection = "🤖 AI Analysis\n\n⚠️ Analysis failed.";
    }

    const reply =
      "🎵 File\n\n" +
      `${downloaded.saveName}\n` +
      `Saved to: ${downloaded.savePath}\n` +
      `Size: ${downloaded.sizeMB} MB (${downloaded.fileSize} bytes)\n\n` +
      "📀 Metadata\n\n" +
      metadataBody +
      "\n\n" +
      aiSection +
      "\n\n" +
      "📤 Publication\n\n" +
      "Status: Готово к проверке";

    const keyboard = new InlineKeyboard()
      .text("✅ Publish", "publish")
      .text("❌ Cancel", "cancel");

    await ctx.reply(reply, { reply_markup: keyboard });
  };
}
