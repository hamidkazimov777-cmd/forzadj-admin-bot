import { Context } from "grammy";
import { downloadTelegramFile } from "../services/telegram-download";
import { extractAudioMetadata } from "../services/audio-metadata";

const AUDIO_EXTENSIONS = [".mp3", ".wav", ".flac", ".aiff"];

function isAudioFile(fileName: string | undefined, mimeType: string | undefined): boolean {
  const name = (fileName ?? "").toLowerCase();
  if (AUDIO_EXTENSIONS.some((ext) => name.endsWith(ext))) return true;
  return mimeType?.startsWith("audio/") ?? false;
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

    const metadataBlock = await extractAudioMetadata(downloaded.savePath);

    await ctx.reply(
      "✅ Audio saved\n\n" +
        `File:\n${downloaded.saveName}\n\n` +
        `Saved to:\n${downloaded.savePath}\n\n` +
        `Size:\n${downloaded.sizeMB} MB (${downloaded.fileSize} bytes)\n\n` +
        metadataBlock
    );
  };
}
