import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: resolve(__dirname, "tests/setup.ts"),
    include: ["tests/unit/**/*.test.ts"],
    exclude: ["tests/e2e/**"],
  },
});
