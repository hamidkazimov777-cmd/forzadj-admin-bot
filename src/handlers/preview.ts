import { InlineKeyboard } from "grammy";
import type { PendingPublication } from "../services/pending";

/** Канонический список жанров ForzaDJ (для кнопок и валидации). */
export const GENRES = [
  "Afro House",
  "Baile Funk",
  "Bass House",
  "Breaks",
  "EDM",
  "Garage",
  "Hip-Hop",
  "House",
  "Jersey Club",
  "Open Format",
  "Pop",
  "Rus",
  "Tech House",
] as const;

function ratingStars(n: number): string {
  const filled = Math.min(5, Math.max(1, Math.round(n)));
  return "★".repeat(filled) + "☆".repeat(5 - filled);
}

export function buildPreviewText(pub: PendingPublication, pos?: number, total?: number): string {
  const ai = pub.aiResult;
  const artist = pub.metadataInput.artist ?? "—";
  const title = pub.metadataInput.title ?? "—";
  const queueLabel = pos !== undefined && total !== undefined && total > 1
    ? ` (${pos}/${total})`
    : "";

  const aiSection = ai
    ? "🤖 AI Analysis\n\n" +
      `Genre:   ${ai.genre}\n` +
      `Mood:    ${ai.mood}\n` +
      `Version: ${ai.version}\n` +
      `Rating:  ${ratingStars(ai.rating)} (${ai.rating}/5)\n` +
      `Artwork: ${pub.artworkPath ? `✅ ${ai.genre}` : "⚠️ не найдена"}`
    : "🤖 AI Analysis\n\n⚠️ Analysis failed.";

  return (
    `📀 Track${queueLabel}\n\n` +
    `Artist:  ${artist}\n` +
    `Title:   ${title}\n\n` +
    aiSection +
    "\n\n" +
    "📤 Publication\n\n" +
    "Status: Готово к проверке"
  );
}

export function buildPreviewKeyboard(queueSize = 1): InlineKeyboard {
  const kb = new InlineKeyboard()
    .text("✅ Publish", "publish")
    .text("✏️ Edit", "edit")
    .row();
  if (queueSize > 1) {
    kb.text("⏭ Skip", "cancel").text(`🗑 Cancel All (${queueSize})`, "cancel_all");
  } else {
    kb.text("❌ Cancel", "cancel");
  }
  return kb;
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
    .text("⭐ Rating", "edit_rating")
    .row()
    .text("« Back", "edit_back");
}

export function buildRatingKeyboard(): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (let n = 1; n <= 5; n++) {
    kb.text(`${"★".repeat(n)} ${n}`, `set_rating_${n}`).row();
  }
  return kb.text("« Back", "edit_back");
}

export function buildGenreKeyboard(): InlineKeyboard {
  const kb = new InlineKeyboard();
  GENRES.forEach((genre, i) => {
    kb.text(genre, `set_genre_${genre}`);
    if (i % 2 === 1) kb.row();
  });
  return kb.row().text("« Back", "edit_back");
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
