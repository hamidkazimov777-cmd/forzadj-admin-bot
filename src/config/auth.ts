function parseAllowedIds(raw: string | undefined): Set<number> {
  const ids = new Set<number>();
  if (!raw) return ids;
  for (const part of raw.split(",")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const id = Number(trimmed);
    if (!Number.isInteger(id) || id <= 0) {
      throw new Error(
        `Invalid Telegram user ID "${trimmed}" in ALLOWED_TELEGRAM_IDS. ` +
          `Expected comma-separated numeric IDs.`
      );
    }
    ids.add(id);
  }
  return ids;
}

const allowedIds = parseAllowedIds(process.env.ALLOWED_TELEGRAM_IDS);

export function isAllowedTelegramUser(userId: number): boolean {
  return allowedIds.has(userId);
}
