import { Bot } from "grammy";
import "dotenv/config";
import { createAudioHandler } from "./handlers/audio";
import { authMiddleware } from "./bot/auth";

const token = process.env.BOT_TOKEN;

if (!token) {
  console.error("Error: BOT_TOKEN is missing. Set it in your .env file.");
  process.exit(1);
}

const bot = new Bot(token);

bot.use(authMiddleware);

bot.command("start", (ctx) => ctx.reply("👋 ForzaDJ Admin Bot is running."));

const handleAudio = createAudioHandler(token);
bot.on("message:audio", (ctx) => handleAudio(ctx, ctx.message.audio));
bot.on("message:document", (ctx) => handleAudio(ctx, ctx.message.document));

bot.start();
console.log("Bot started, polling for updates...");
