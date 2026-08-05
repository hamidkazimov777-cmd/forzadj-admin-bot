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
      `Genre:   ${ai.genre}\n` +
      `Mood:    ${ai.mood}\n` +
      `Version: ${ai.version}\n` +
      `Rating:  ${ratingStars(ai.rating)} (${ai.rating}/5)\n` +
      `Artwork: ${pub.artworkPath ? `✅ ${ai.genre}` : "⚠️ не найдена"}`
    : "🤖 AI Analysis\n\n⚠️ Analysis failed.";

  return (
    "📀 Track\n\n" +
    `Artist:  ${artist}\n` +
    `Title:   ${title}\n\n` +
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
    .text("🎸 Genre", "edit_genre")
    .text("🌙 Mood", "edit_mood")
    .row()
    .text("🔀 Version", "edit_version")
    .row()
    .text("« Back", "edit_back");
}

export function buildMoodKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("🌅 Warm Up", "set_mood_Warm Up")
    .row()
    .text("🔥 Prime Time", "set_mood_Prime Time")
    .row()
    .text("🌙 After Party", "set_mood_After Party")
    .row()
    .text("« Back", "edit_back");
}

export function buildVersionKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("Original", "set_version_Original")
    .text("Extended", "set_version_Extended")
    .row()
    .text("Remix", "set_version_Remix")
    .text("Mashup", "set_version_Mashup")
    .row()
    .text("« Back", "edit_back");
}
