import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const devPort = Number(process.env.SHIPKIT_DEV_PORT ?? "1420");

export default defineConfig({
  plugins: [react()],
  cacheDir: process.env.VITE_CACHE_DIR ?? "node_modules/.vite",
  clearScreen: false,
  server: {
    strictPort: true,
    port: devPort,
  },
  test: {
    environment: "jsdom",
    globals: false,
    setupFiles: "./src/vitest.setup.ts",
  },
});
