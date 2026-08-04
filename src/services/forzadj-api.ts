import fs from "fs/promises";
import type { PendingPublication } from "./pending";

export interface PublishResult {
  trackId: string;
  slug: string;
  studioUrl: string;
}

export async function publishTrack(pub: PendingPublication): Promise<PublishResult> {
  const apiUrl = process.env.FORZADJ_API_URL;
  const secret = process.env.FORZADJ_BOT_SECRET;

  if (!apiUrl || !secret) {
    throw new Error(
      "ForzaDJ API is not configured. Set FORZADJ_API_URL and FORZADJ_BOT_SECRET in .env.",
    );
  }

  const fileBuffer = await fs.readFile(pub.filePath);
  const fileBlob = new Blob([fileBuffer], { type: pub.mimeType });

  const artworkBlob = pub.artworkPath
    ? new Blob([await fs.readFile(pub.artworkPath)], { type: "image/png" })
    : null;

  const metadata = {
    title: pub.metadataInput.title,
    artist: pub.metadataInput.artist,
    year: pub.metadataInput.year,
    genre: pub.aiResult?.genre,
    mood: pub.aiResult?.mood,
    version: pub.aiResult?.version,
    energy: pub.aiResult?.rating,
    fileName: pub.fileName,
    mimeType: pub.mimeType,
  };

  // Content-Disposition filename must be ASCII (RFC 7578). Non-ASCII characters
  // (Cyrillic, etc.) in the filename break the multipart parser on the server side.
  // The original filename is preserved in metadata.fileName → Asset.originalName in DB.
  const ext = (pub.fileName.match(/\.([a-z0-9]+)$/i)?.[1] ?? "mp3").toLowerCase();
  const safeFileName = `track.${ext}`;

  const form = new FormData();
  form.append("file", fileBlob, safeFileName);
  form.append("metadata", JSON.stringify(metadata));
  if (artworkBlob) {
    form.append("artwork", artworkBlob, "artwork.png");
  }

  const res = await fetch(`${apiUrl.replace(/\/$/, "")}/api/bot/upload`, {
    method: "POST",
    headers: { "x-bot-secret": secret },
    body: form,
  });

  const body = (await res.json()) as
    | { success: true; trackId: string; slug: string; studioUrl: string }
    | { error: string };

  if (!res.ok || !("success" in body)) {
    throw new Error("error" in body ? body.error : `HTTP ${res.status}`);
  }

  return { trackId: body.trackId, slug: body.slug, studioUrl: body.studioUrl };
}
