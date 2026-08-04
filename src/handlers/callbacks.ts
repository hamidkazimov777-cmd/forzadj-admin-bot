import { Bot, Context } from "grammy";
import { pendingStore } from "../services/pending";
import { publishTrack } from "../services/forzadj-api";

async function onPublish(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery();

  const chatId = ctx.chat?.id;
  if (chatId === undefined) return;

  const pending = pendingStore.get(chatId);
  if (!pending) {
    await ctx.reply("⚠️ Nothing to publish. Send an audio file first.");
    return;
  }

  // Clear immediately to prevent double-publish on repeated clicks.
  pendingStore.clear(chatId);

  // Remove inline keyboard from the preview message.
  await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } });

  await ctx.reply("⏳ Publishing...");

  try {
    const result = await publishTrack(pending);
    await ctx.reply(
      `✅ Successfully published to ForzaDJ.\n\n` +
        `Track ID: ${result.trackId}\n` +
        `Studio: ${result.studioUrl}`,
    );
  } catch (err) {
    await ctx.reply(
      `❌ Publication failed:\n${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

async function onCancel(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery();

  const chatId = ctx.chat?.id;
  if (chatId !== undefined) {
    pendingStore.clear(chatId);
  }

  await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } });
  await ctx.reply("Publication cancelled.");
}

export function registerCallbackHandlers(bot: Bot): void {
  bot.callbackQuery("publish", onPublish);
  bot.callbackQuery("cancel", onCancel);
}
