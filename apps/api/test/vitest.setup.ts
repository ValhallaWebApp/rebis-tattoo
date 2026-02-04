import { config } from "dotenv";
import fs from "node:fs";
import path from "node:path";

// Carica prima .env.test (solo locale), altrimenti .env (locale), altrimenti .env.example (fallback non-segreto)
const root = path.resolve(__dirname, "..");
const candidates = [".env.test", ".env", ".env.example"].map(p => path.join(root, p));

for (const p of candidates) {
  if (fs.existsSync(p)) {
    config({ path: p });
    break;
  }
}

// Safety: se DATABASE_URL non è settata, falliamo con messaggio chiaro
if (!process.env.DATABASE_URL) {
  throw new Error(
    "Missing DATABASE_URL for tests. Create apps/api/.env.test (ignored) or export DATABASE_URL before running tests."
  );
}
