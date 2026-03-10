import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  cacheDir: process.env.VITE_CACHE_DIR ?? "node_modules/.vite",
  clearScreen: false,
  server: {
    strictPort: true,
    port: 1420,
  },
  test: {
    environment: "jsdom",
    globals: false,
    setupFiles: "./src/vitest.setup.ts",
  },
});
