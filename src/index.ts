import { Bot, GrammyError } from "grammy";
import "dotenv/config";
import { createAudioHandler } from "./handlers/audio";
import { registerCallbackHandlers } from "./handlers/callbacks";
import { authMiddleware } from "./bot/auth";
import { pendingStore } from "./services/pending";
import { buildPreviewText, buildPreviewKeyboard } from "./handlers/preview";
import { getArtworkPath } from "./services/artwork";

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

// Handle text input when waiting for edited artist/title
bot.on("message:text", async (ctx) => {
  const chatId = ctx.chat?.id;
  if (!chatId) return;
  const pending = pendingStore.get(chatId);
  if (!pending?.waitingFor) return;

  const field = pending.waitingFor;
  pending.waitingFor = undefined;

  if (field === "artist") {
    pending.metadataInput.artist = ctx.message.text.trim();
  } else if (field === "title") {
    pending.metadataInput.title = ctx.message.text.trim();
  } else if (field === "genre" && pending.aiResult) {
    pending.aiResult.genre = ctx.message.text.trim();
    pending.artworkPath = await getArtworkPath(pending.aiResult.genre);
  }

  await ctx.reply(buildPreviewText(pending), { reply_markup: buildPreviewKeyboard() });
});

registerCallbackHandlers(bot);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function startWithRetry() {
  while (true) {
    try {
      console.log("Bot started, polling for updates...");
      await bot.start();
      break;
    } catch (err) {
      if (err instanceof GrammyError && err.error_code === 409) {
        console.log("409 Conflict — another instance is shutting down, retrying in 15s...");
        await sleep(15_000);
      } else {
        throw err;
      }
    }
  }
}

startWithRetry();
