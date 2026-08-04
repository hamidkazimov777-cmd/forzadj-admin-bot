import { mkdir, writeFile, access } from "fs/promises";
import path from "path";

export interface DownloadedFile {
  saveName: string;
  savePath: string;
  fileSize: number;
  sizeMB: string;
}

export async function downloadTelegramFile(
  token: string,
  api: { getFile: (fileId: string) => Promise<{ file_path?: string }> },
  file: { file_id: string; file_size?: number; file_name?: string }
): Promise<DownloadedFile | null> {
  const fileName = file.file_name ?? "unknown";

  // Create dated temp directory: temp/YYYY-MM-DD/
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10);
  const dir = path.join("temp", dateStr);
  await mkdir(dir, { recursive: true });

  // If filename exists, append timestamp (HHMMSS)
  let saveName = fileName;
  try {
    await access(path.join(dir, saveName));
    const ext = path.extname(fileName);
    const base = path.basename(fileName, ext);
    const ts =
      String(date.getHours()).padStart(2, "0") +
      String(date.getMinutes()).padStart(2, "0") +
      String(date.getSeconds()).padStart(2, "0");
    saveName = `${base}_${ts}${ext}`;
  } catch {
    // file does not exist, keep original name
  }

  // Download from Telegram and save locally
  const fileSize = file.file_size ?? 0;
  const sizeMB = (fileSize / (1024 * 1024)).toFixed(2);
  const tgFile = await api.getFile(file.file_id);
  const url = `https://api.telegram.org/file/bot${token}/${tgFile.file_path}`;
  const res = await fetch(url);
  if (!res.ok) {
    return null;
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  const savePath = path.join(dir, saveName);
  await writeFile(savePath, buffer);

  return { saveName, savePath, fileSize, sizeMB };
}
