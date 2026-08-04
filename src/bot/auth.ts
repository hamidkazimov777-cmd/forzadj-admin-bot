import { Context, NextFunction } from "grammy";
import { isAllowedTelegramUser } from "../config/auth";

// Access control: allow only private chats and whitelisted Telegram users.
// Must be registered before every handler.
export async function authMiddleware(
  ctx: Context,
  next: NextFunction
): Promise<void> {
  const chatType = ctx.chat?.type;
  const userId = ctx.from?.id;

  if (chatType !== "private" || userId === undefined || !isAllowedTelegramUser(userId)) {
    await ctx.reply("⛔ Access denied.");
    return;
  }

  await next();
}
