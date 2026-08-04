import { Bot, Context } from "grammy";
import { pendingStore } from "../services/pending";
import { publishTrack } from "../services/forzadj-api";
import { buildPreviewText, buildPreviewKeyboard, buildEditKeyboard } from "./preview";

async function onPublish(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery();

  const chatId = ctx.chat?.id;
  if (chatId === undefined) return;

  const pending = pendingStore.get(chatId);
  if (!pending) {
    await ctx.reply("⚠️ Nothing to publish. Send an audio file first.");
    return;
  }

  pendingStore.clear(chatId);
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

async function onEdit(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery();
  await ctx.reply("Что редактировать?", { reply_markup: buildEditKeyboard() });
}

async function onEditArtist(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery();
  const chatId = ctx.chat?.id;
  if (chatId === undefined) return;
  const pending = pendingStore.get(chatId);
  if (!pending) { await ctx.reply("⚠️ Нет активного трека."); return; }
  pending.waitingFor = "artist";
  const current = pending.metadataInput.artist ?? "—";
  await ctx.reply(`Текущий артист: ${current}\n\nОтправь новое имя артиста:`);
}

async function onEditTitle(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery();
  const chatId = ctx.chat?.id;
  if (chatId === undefined) return;
  const pending = pendingStore.get(chatId);
  if (!pending) { await ctx.reply("⚠️ Нет активного трека."); return; }
  pending.waitingFor = "title";
  const current = pending.metadataInput.title ?? "—";
  await ctx.reply(`Текущее название: ${current}\n\nОтправь новое название:`);
}

async function onEditBack(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery();
  const chatId = ctx.chat?.id;
  if (chatId === undefined) return;
  const pending = pendingStore.get(chatId);
  if (!pending) { await ctx.reply("⚠️ Нет активного трека."); return; }
  pending.waitingFor = undefined;
  await ctx.reply(buildPreviewText(pending), { reply_markup: buildPreviewKeyboard() });
}

async function onCancel(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery();
  const chatId = ctx.chat?.id;
  if (chatId !== undefined) pendingStore.clear(chatId);
  await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } });
  await ctx.reply("Publication cancelled.");
}

export function registerCallbackHandlers(bot: Bot): void {
  bot.callbackQuery("publish", onPublish);
  bot.callbackQuery("edit", onEdit);
  bot.callbackQuery("edit_artist", onEditArtist);
  bot.callbackQuery("edit_title", onEditTitle);
  bot.callbackQuery("edit_back", onEditBack);
  bot.callbackQuery("cancel", onCancel);
}
