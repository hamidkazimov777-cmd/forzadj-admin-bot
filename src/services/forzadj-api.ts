import fs from "fs/promises";
// Node's global fetch is backed by its own internal (built-in) undici, which
// isn't guaranteed to be interface-compatible with a separately installed
// undici package's Agent/Dispatcher. Using this package's own fetch alongside
// its own Agent keeps both on the same implementation.
import { fetch, Agent, FormData } from "undici";
import type { PendingPublication } from "./pending";

export interface PublishResult {
  trackId: string;
  slug: string;
  studioUrl: string;
}

// Publishes are infrequent and often separated by minutes (the admin reading
// the AI analysis, editing artist/title, deciding to publish) — long enough
// for an idle pooled connection to be silently recycled by an intermediate
// network hop (e.g. the hosting platform's outbound NAT/proxy) while Node's
// own fetch client still considers it reusable. Reusing that stale socket
// produces a response with an empty body, which fails with "Unexpected end
// of JSON input" when parsed. A short keep-alive timeout forces a fresh
// connection per publish, eliminating the class of bug — the extra TCP/TLS
// handshake (~100-300ms) is negligible next to the multi-second publish call.
const freshConnectionAgent = new Agent({ keepAliveTimeout: 1, keepAliveMaxTimeout: 1 });

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
    dispatcher: freshConnectionAgent,
  });

  const body = (await res.json()) as
    | { success: true; trackId: string; slug: string; studioUrl: string }
    | { error: string };

  if (!res.ok || !("success" in body)) {
    throw new Error("error" in body ? body.error : `HTTP ${res.status}`);
  }

  return { trackId: body.trackId, slug: body.slug, studioUrl: body.studioUrl };
}

export interface HistoricalStats {
  name: string;
  totalTracks: number;
  topGenres: { name: string; count: number }[];
}

export interface HistoricalProfileResponse {
  artist: HistoricalStats | null;
  remixer: HistoricalStats | null;
}

export async function fetchHistoricalProfile(artist?: string, remixer?: string): Promise<HistoricalProfileResponse | null> {
  const apiUrl = process.env.FORZADJ_API_URL;
  const secret = process.env.FORZADJ_BOT_SECRET;

  if (!apiUrl || !secret || (!artist && !remixer)) return null;

  try {
    const params = new URLSearchParams();
    if (artist) params.append("artist", artist);
    if (remixer) params.append("remixer", remixer);

    const res = await fetch(`${apiUrl.replace(/\/$/, "")}/api/bot/history?${params.toString()}`, {
      method: "GET",
      headers: { "x-bot-secret": secret },
      dispatcher: freshConnectionAgent,
    });

    if (!res.ok) return null;

    return (await res.json()) as HistoricalProfileResponse;
  } catch (err) {
    console.error("[bot/history] Failed to fetch historical profile:", err);
    return null;
  }
}
