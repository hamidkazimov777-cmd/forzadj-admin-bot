import { Bot, Context } from "grammy";

// Called when the user clicks "✅ Publish".
// TODO: replace the stub with a call to the ForzaDJ API when ready.
async function onPublish(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery();
  await ctx.reply("Publishing is not implemented yet.");
}

// Called when the user clicks "❌ Cancel".
async function onCancel(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery();
  await ctx.reply("Publication cancelled.");
}

export function registerCallbackHandlers(bot: Bot): void {
  bot.callbackQuery("publish", onPublish);
  bot.callbackQuery("cancel", onCancel);
}
