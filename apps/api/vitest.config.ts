import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["./test/vitest.setup.ts"],
    // opzionale: evita test paralleli se vuoi stabilità con DB
    // pool: "threads",
    // fileParallelism: false,
  },
});
