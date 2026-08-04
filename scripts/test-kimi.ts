import "dotenv/config";
import { analyzeTrack } from "../src/services/ai/provider";

async function main() {
  const result = await analyzeTrack({
    artist: "Test Artist",
    title: "Test Title",
  });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error("Error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
