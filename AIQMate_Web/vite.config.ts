/// <reference types="vitest/config" />
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// SPEC-036 / ADR-011 §3. The SPA and api-service share one site so the session cookie works.
// On a laptop the dev server proxies /api to api-service on :3000; the browser only ever sees
// http://localhost:5173, so cookies set by api-service land on this origin and no CORS is needed.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api/v1/asset-hierarchy": { target: "http://localhost:3001" },
      "/api/v1/assets": { target: "http://localhost:3001" },
      "/api": { target: "http://localhost:3001", changeOrigin: false },
    },
  },
  preview: { port: 5173 },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
