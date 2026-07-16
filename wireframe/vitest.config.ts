import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const directory = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: { alias: { "@": path.join(directory, "src") } },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/tests/setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      thresholds: { statements: 85, lines: 85, functions: 85, branches: 80 },
      // MapLibre's WebGL adapter is exercised in the Playwright vertical-slice test.
      exclude: ["src/tests/**", "src/**/*.test.*", "src/**/__tests__/**", "src/**/*.d.ts", "src/features/map/map-canvas.tsx"]
    }
  }
});
