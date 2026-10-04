import { fileURLToPath } from "node:url"

import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Vite 8 resolves tsconfig "paths" (@/*) natively.
    tsconfigPaths: true,
    alias: {
      // The real package throws outside an RSC graph; stub it for tests.
      "server-only": fileURLToPath(new URL("./test/stubs/server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    // Tailwind v4 CSS imports are not resolvable (or useful) under Vitest.
    css: false,
    include: ["**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", ".next"],
    // Long user-event flows (picker save, Radix portals, optimizer settles)
    // finish in ms unloaded but have blown the 5s default when the full suite
    // saturates every core. The ceiling is a flake guard, not a target.
    testTimeout: 30_000,
  },
})
