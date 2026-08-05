import type { AIInput, AIOutput } from "./ai/types";

export interface PendingPublication {
  filePath: string;
  fileName: string;
  mimeType: string;
  metadataInput: AIInput;
  aiResult: AIOutput | null;
  artworkPath: string | null;
  waitingFor?: "artist" | "title" | "genre";
}

const store = new Map<number, PendingPublication[]>();

export const pendingStore = {
  /** Add to queue, return new queue size. */
  push(chatId: number, pub: PendingPublication): number {
    const q = store.get(chatId) ?? [];
    q.push(pub);
    store.set(chatId, q);
    return q.length;
  },
  /** Current (first) item without removing. */
  peek(chatId: number): PendingPublication | undefined {
    return store.get(chatId)?.[0];
  },
  size(chatId: number): number {
    return store.get(chatId)?.length ?? 0;
  },
  /** Remove current, return next (new first) or undefined if queue now empty. */
  advance(chatId: number): PendingPublication | undefined {
    const q = store.get(chatId);
    if (!q || q.length === 0) return undefined;
    q.shift();
    if (q.length === 0) { store.delete(chatId); return undefined; }
    return q[0];
  },
  /** Remove all items and return them (for temp-file cleanup). */
  clearAll(chatId: number): PendingPublication[] {
    const q = store.get(chatId) ?? [];
    store.delete(chatId);
    return q;
  },
};
