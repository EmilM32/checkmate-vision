import path from "path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  esbuild: {
    jsx: "automatic",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    include: ["**/__tests__/**/*.test.{ts,tsx}"],
    environment: "happy-dom",
  },
})
