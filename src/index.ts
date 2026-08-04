import { Bot, Context } from "grammy";
import { parseFile } from "music-metadata";
import { mkdir, writeFile, access } from "fs/promises";
import path from "path";
import "dotenv/config";

const token = process.env.BOT_TOKEN;

if (!token) {
  console.error("Error: BOT_TOKEN is missing. Set it in your .env file.");
  process.exit(1);
}

const bot = new Bot(token);

bot.command("start", (ctx) => ctx.reply("👋 ForzaDJ Admin Bot is running."));

const AUDIO_EXTENSIONS = [".mp3", ".wav", ".flac", ".aiff"];

function isAudioFile(fileName: string | undefined, mimeType: string | undefined): boolean {
  const name = (fileName ?? "").toLowerCase();
  if (AUDIO_EXTENSIONS.some((ext) => name.endsWith(ext))) return true;
  return mimeType?.startsWith("audio/") ?? false;
}

async function handleAudio(
  ctx: Context,
  file: { file_id: string; file_size?: number; file_name?: string; mime_type?: string }
) {
  if (!isAudioFile(file.file_name, file.mime_type)) {
    await ctx.reply("Unsupported file type.");
    return;
  }

  const fileName = file.file_name ?? "unknown";

  // Create dated temp directory: temp/YYYY-MM-DD/
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10);
  const dir = path.join("temp", dateStr);
  await mkdir(dir, { recursive: true });

  // If filename exists, append timestamp (HHMMSS)
  let saveName = fileName;
  try {
    await access(path.join(dir, saveName));
    const ext = path.extname(fileName);
    const base = path.basename(fileName, ext);
    const ts =
      String(date.getHours()).padStart(2, "0") +
      String(date.getMinutes()).padStart(2, "0") +
      String(date.getSeconds()).padStart(2, "0");
    saveName = `${base}_${ts}${ext}`;
  } catch {
    // file does not exist, keep original name
  }

  // Download from Telegram and save locally
  const fileSize = file.file_size ?? 0;
  const sizeMB = (fileSize / (1024 * 1024)).toFixed(2);
  const tgFile = await ctx.api.getFile(file.file_id);
  const url = `https://api.telegram.org/file/bot${token}/${tgFile.file_path}`;
  const res = await fetch(url);
  if (!res.ok) {
    await ctx.reply("⚠️ Failed to download the file from Telegram.");
    return;
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  const savePath = path.join(dir, saveName);
  await writeFile(savePath, buffer);

  // Extract metadata locally from the saved file
  let metadataBlock = "Metadata: unavailable (could not parse file)";
  try {
    const meta = await parseFile(savePath);
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
    metadataBlock =
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
  } catch {
    // keep fallback metadata message
  }

  await ctx.reply(
    "✅ Audio saved\n\n" +
      `File:\n${saveName}\n\n` +
      `Saved to:\n${savePath}\n\n` +
      `Size:\n${sizeMB} MB (${fileSize} bytes)\n\n` +
      metadataBlock
  );
}

bot.on("message:audio", (ctx) => handleAudio(ctx, ctx.message.audio));
bot.on("message:document", (ctx) => handleAudio(ctx, ctx.message.document));

bot.start();
console.log("Bot started, polling for updates...");
