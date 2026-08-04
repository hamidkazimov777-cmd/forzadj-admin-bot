import type { AIInput, AIOutput } from "./ai/types";

export interface PendingPublication {
  filePath: string;
  fileName: string;
  mimeType: string;
  metadataInput: AIInput;
  aiResult: AIOutput | null;
  artworkPath: string | null;
}

// Keyed by chatId. Single-admin bot — one pending publication per chat at a time.
const store = new Map<number, PendingPublication>();

export const pendingStore = {
  set(chatId: number, pub: PendingPublication): void {
    store.set(chatId, pub);
  },
  get(chatId: number): PendingPublication | undefined {
    return store.get(chatId);
  },
  clear(chatId: number): void {
    store.delete(chatId);
  },
};
