import { Context } from "grammy";
import { downloadTelegramFile } from "../services/telegram-download";
import { extractAudioMetadata, cleanTitle } from "../services/audio-metadata";
import { analyzeTrack } from "../services/ai/provider";
import { fetchHistoricalProfile } from "../services/forzadj-api";
import { convertToMp3IfNeeded } from "../services/ffmpeg";
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

    try {
      const newPath = await convertToMp3IfNeeded(downloaded.savePath);
      if (newPath !== downloaded.savePath) {
        downloaded.savePath = newPath;
        downloaded.saveName = newPath.split('/').pop() || downloaded.saveName;
        file.mime_type = "audio/mpeg";
      }
    } catch (err) {
      console.error("[ffmpeg] conversion error:", err);
      // We log but continue, falling back to original file if conversion broke unexpectedly 
      // (though it throws after deleting output, the original file is still there).
    }

    const { input: metadataInput } = await extractAudioMetadata(downloaded.savePath, file.file_name);

    if (!metadataInput.artist && file.performer) {
      metadataInput.artist = file.performer;
    }
    if (!metadataInput.title && file.title) {
      metadataInput.title = cleanTitle(file.title);
    }

    let aiResult: AIOutput | null = null;
    let artworkPath: string | null = null;
    try {
      const history = await fetchHistoricalProfile(metadataInput.artist, metadataInput.remixer);
      if (history) {
        let profileStr = "";
        
        if (history.remixer) {
          profileStr += `REMIXER: ${history.remixer.name}\n`;
          for (const g of history.remixer.topGenres) {
            const pct = Math.round((g.count / history.remixer.totalTracks) * 100);
            profileStr += `- ${g.name}: ${pct}% (${g.count} tracks)\n`;
          }
          profileStr += "\n";
        }
        
        if (history.artist) {
          profileStr += `ORIGINAL ARTIST: ${history.artist.name}\n`;
          for (const g of history.artist.topGenres) {
            const pct = Math.round((g.count / history.artist.totalTracks) * 100);
            profileStr += `- ${g.name}: ${pct}% (${g.count} tracks)\n`;
          }
          profileStr += "\n";
        }

        if (profileStr) {
          let instruction = "";
          if (history.remixer) {
            instruction = `CRITICAL INSTRUCTION: Since this is a remix by ${history.remixer.name}, ${history.remixer.name}'s historical profile dictates the genre. Ignore the original artist's typical style and base your decision primarily on the remixer's history.`;
          } else {
            instruction = `CRITICAL INSTRUCTION: Use this historical data as a very strong signal. If the BPM and title do not contradict this, default to the artist's most frequent genre.`;
          }
          metadataInput.historicalProfile = `Historical Profile (from catalog):\n\n${profileStr}${instruction}`;
        }
      }

      aiResult = await analyzeTrack(metadataInput);
      artworkPath = await getArtworkPath(aiResult.genre);
    } catch (err) {
      console.error("[AI] analysis failed:", err);
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
      const queueSize = pendingStore.push(chatId, pub);

      if (queueSize === 1) {
        // First in queue — show preview immediately.
        await ctx.reply(buildPreviewText(pub, 1, 1), { reply_markup: buildPreviewKeyboard(1) });
      } else {
        // Already reviewing another track — let user know it's queued.
        const artist = metadataInput.artist ?? "—";
        const title = metadataInput.title ?? "—";
        await ctx.reply(
          `🎵 ${artist} — ${title}\n` +
          `Добавлен в очередь (#${queueSize}). Опубликуй текущий трек, затем появится следующий.`
        );
      }
    }
  };
}
