import path from "path";
import fs from "fs/promises";

const ARTWORK_DIR = path.resolve(__dirname, "../../assets/artwork");

const GENRE_FILE_MAP: Record<string, string> = {
  "Afro House": "afro-house.png",
  "Baile Funk": "baile-funk.png",
  "Bass House": "bass-house.png",
  "Breaks": "breaks.png",
  "EDM": "edm.png",
  "Garage": "garage.png",
  "Hip-Hop": "hip-hop.png",
  "House": "house.png",
  "Jersey Club": "jersey-club.png",
  "Open Format": "open-format.png",
  "Pop": "pop.png",
  "Rus": "rus.png",
  "Tech House": "tech-house.png",
};

export async function getArtworkPath(genre: string): Promise<string | null> {
  const fileName = GENRE_FILE_MAP[genre] ?? "open-format.png";
  const filePath = path.join(ARTWORK_DIR, fileName);
  try {
    await fs.access(filePath);
    return filePath;
  } catch {
    return null;
  }
}
