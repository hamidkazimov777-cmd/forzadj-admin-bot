import { Bot, Context } from "grammy";
import { unlink } from "fs/promises";
import { pendingStore } from "../services/pending";
import { publishTrack } from "../services/forzadj-api";
import { getArtworkPath } from "../services/artwork";
import {
  buildPreviewText,
  buildPreviewKeyboard,
  buildEditKeyboard,
  buildMoodKeyboard,
  buildVersionKeyboard,
} from "./preview";

async function showNext(ctx: Context, chatId: number): Promise<void> {
  const next = pendingStore.peek(chatId);
  if (next) {
    const size = pendingStore.size(chatId);
    await ctx.reply(buildPreviewText(next, 1, size), { reply_markup: buildPreviewKeyboard(size) });
  }
}

async function onPublish(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery();

  const chatId = ctx.chat?.id;
  if (chatId === undefined) return;

  const pending = pendingStore.peek(chatId);
  if (!pending) {
    await ctx.reply("⚠️ Nothing to publish. Send an audio file first.");
    return;
  }

  await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } }).catch(() => {});
  await ctx.reply("⏳ Publishing...");

  try {
    const result = await publishTrack(pending);
    pendingStore.advance(chatId);
    await unlink(pending.filePath).catch(() => {});
    const queueSize = pendingStore.size(chatId);
    await ctx.reply(
      `✅ Successfully published to ForzaDJ.\n\n` +
        `Track ID: ${result.trackId}\n` +
        `Studio: ${result.studioUrl}` +
        (queueSize > 0 ? `\n\n📋 Следующий трек (${queueSize} в очереди):` : ""),
    );
    await showNext(ctx, chatId);
  } catch (err) {
    console.error(`[publish] failed for chat ${chatId}:`, err);
    const size = pendingStore.size(chatId);
    await ctx.reply(
      `❌ Publication failed:\n${err instanceof Error ? err.message : String(err)}\n\n` +
        `Track data preserved — tap ✅ Publish to retry.`,
      { reply_markup: buildPreviewKeyboard(size) },
    );
  }
}

async function onEdit(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery();
  const chatId = ctx.chat?.id;
  if (chatId === undefined) return;
  const pending = pendingStore.peek(chatId);
  if (!pending) { await ctx.reply("⚠️ Нет активного трека."); return; }
  await ctx.reply("Что редактировать?", { reply_markup: buildEditKeyboard() });
}

async function onEditArtist(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery();
  const chatId = ctx.chat?.id;
  if (chatId === undefined) return;
  const pending = pendingStore.peek(chatId);
  if (!pending) { await ctx.reply("⚠️ Нет активного трека."); return; }
  pending.waitingFor = "artist";
  await ctx.reply(`Текущий артист: ${pending.metadataInput.artist ?? "—"}\n\nОтправь новое имя:`);
}

async function onEditTitle(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery();
  const chatId = ctx.chat?.id;
  if (chatId === undefined) return;
  const pending = pendingStore.peek(chatId);
  if (!pending) { await ctx.reply("⚠️ Нет активного трека."); return; }
  pending.waitingFor = "title";
  await ctx.reply(`Текущее название: ${pending.metadataInput.title ?? "—"}\n\nОтправь новое название:`);
}

async function onEditGenre(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery();
  const chatId = ctx.chat?.id;
  if (chatId === undefined) return;
  const pending = pendingStore.peek(chatId);
  if (!pending) { await ctx.reply("⚠️ Нет активного трека."); return; }
  pending.waitingFor = "genre";
  const current = pending.aiResult?.genre ?? "—";
  await ctx.reply(
    `Текущий жанр: ${current}\n\n` +
    `Доступные жанры:\n` +
    `Afro House · Baile Funk · Bass House · Breaks · EDM\n` +
    `Garage · Hip-Hop · House · Jersey Club · Open Format\n` +
    `Pop · Rus · Tech House\n\n` +
    `Отправь новый жанр (точно как написано выше):`
  );
}

async function onEditMood(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery();
  const chatId = ctx.chat?.id;
  if (chatId === undefined) return;
  const pending = pendingStore.peek(chatId);
  if (!pending) { await ctx.reply("⚠️ Нет активного трека."); return; }
  const current = pending.aiResult?.mood ?? "—";
  await ctx.reply(`Текущее настроение: ${current}\n\nВыбери:`, { reply_markup: buildMoodKeyboard() });
}

async function onEditVersion(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery();
  const chatId = ctx.chat?.id;
  if (chatId === undefined) return;
  const pending = pendingStore.peek(chatId);
  if (!pending) { await ctx.reply("⚠️ Нет активного трека."); return; }
  const current = pending.aiResult?.version ?? "—";
  await ctx.reply(`Текущая версия: ${current}\n\nВыбери:`, { reply_markup: buildVersionKeyboard() });
}

async function onSetMood(ctx: Context, mood: string): Promise<void> {
  await ctx.answerCallbackQuery();
  const chatId = ctx.chat?.id;
  if (chatId === undefined) return;
  const pending = pendingStore.peek(chatId);
  if (!pending || !pending.aiResult) { await ctx.reply("⚠️ Нет активного трека."); return; }
  pending.aiResult.mood = mood;
  const size = pendingStore.size(chatId);
  await ctx.reply(buildPreviewText(pending, 1, size), { reply_markup: buildPreviewKeyboard(size) });
}

async function onSetVersion(ctx: Context, version: string): Promise<void> {
  await ctx.answerCallbackQuery();
  const chatId = ctx.chat?.id;
  if (chatId === undefined) return;
  const pending = pendingStore.peek(chatId);
  if (!pending || !pending.aiResult) { await ctx.reply("⚠️ Нет активного трека."); return; }
  pending.aiResult.version = version;
  const size = pendingStore.size(chatId);
  await ctx.reply(buildPreviewText(pending, 1, size), { reply_markup: buildPreviewKeyboard(size) });
}

async function onEditBack(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery();
  const chatId = ctx.chat?.id;
  if (chatId === undefined) return;
  const pending = pendingStore.peek(chatId);
  if (!pending) { await ctx.reply("⚠️ Нет активного трека."); return; }
  pending.waitingFor = undefined;
  const size = pendingStore.size(chatId);
  await ctx.reply(buildPreviewText(pending, 1, size), { reply_markup: buildPreviewKeyboard(size) });
}

async function onCancel(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery();
  const chatId = ctx.chat?.id;
  if (chatId === undefined) return;
  const current = pendingStore.peek(chatId);
  pendingStore.advance(chatId);
  if (current) await unlink(current.filePath).catch(() => {});
  await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } }).catch(() => {});

  const queueSize = pendingStore.size(chatId);
  if (queueSize > 0) {
    await ctx.reply(`⏭ Пропущен. Следующий трек (${queueSize} в очереди):`);
    await showNext(ctx, chatId);
  } else {
    await ctx.reply("Publication cancelled.");
  }
}

async function onCancelAll(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery();
  const chatId = ctx.chat?.id;
  if (chatId === undefined) return;
  const all = pendingStore.clearAll(chatId);
  await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } }).catch(() => {});
  for (const pub of all) await unlink(pub.filePath).catch(() => {});
  await ctx.reply(`🗑 Отменено ${all.length} ${all.length === 1 ? "трек" : all.length < 5 ? "трека" : "треков"}.`);
}

export function registerCallbackHandlers(bot: Bot): void {
  bot.callbackQuery("publish", onPublish);
  bot.callbackQuery("edit", onEdit);
  bot.callbackQuery("edit_artist", onEditArtist);
  bot.callbackQuery("edit_title", onEditTitle);
  bot.callbackQuery("edit_genre", onEditGenre);
  bot.callbackQuery("edit_mood", onEditMood);
  bot.callbackQuery("edit_version", onEditVersion);
  bot.callbackQuery("edit_back", onEditBack);
  bot.callbackQuery("cancel", onCancel);
  bot.callbackQuery("cancel_all", onCancelAll);

  for (const mood of ["Warm Up", "Prime Time", "After Party"]) {
    bot.callbackQuery(`set_mood_${mood}`, (ctx) => onSetMood(ctx, mood));
  }
  for (const version of ["Original", "Extended", "Remix", "Mashup"]) {
    bot.callbackQuery(`set_version_${version}`, (ctx) => onSetVersion(ctx, version));
  }
}
