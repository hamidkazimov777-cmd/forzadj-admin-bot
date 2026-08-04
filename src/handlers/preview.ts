import { InlineKeyboard } from "grammy";
import type { PendingPublication } from "../services/pending";

function ratingStars(n: number): string {
  const filled = Math.min(5, Math.max(1, Math.round(n)));
  return "★".repeat(filled) + "☆".repeat(5 - filled);
}

export function buildPreviewText(pub: PendingPublication): string {
  const ai = pub.aiResult;
  const artist = pub.metadataInput.artist ?? "—";
  const title = pub.metadataInput.title ?? "—";

  const aiSection = ai
    ? "🤖 AI Analysis\n\n" +
      `Genre: ${ai.genre}\n` +
      `Mood: ${ai.mood}\n` +
      `Version: ${ai.version}\n` +
      `Rating: ${ratingStars(ai.rating)} (${ai.rating}/5)\n` +
      `Artwork: ${pub.artworkPath ? `✅ ${ai.genre}` : "⚠️ не найдена"}`
    : "🤖 AI Analysis\n\n⚠️ Analysis failed.";

  return (
    "📀 Track\n\n" +
    `Artist: ${artist}\n` +
    `Title:  ${title}\n\n` +
    aiSection +
    "\n\n" +
    "📤 Publication\n\n" +
    "Status: Готово к проверке"
  );
}

export function buildPreviewKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("✅ Publish", "publish")
    .text("✏️ Edit", "edit")
    .row()
    .text("❌ Cancel", "cancel");
}

export function buildEditKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("👤 Artist", "edit_artist")
    .text("🎵 Title", "edit_title")
    .row()
    .text("« Back", "edit_back");
}
