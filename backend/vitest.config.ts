import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    fileParallelism: false,
    maxWorkers: 1,
    isolate: true,
    maxConcurrency: 1,
    allowOnly: false,
    passWithNoTests: false,
    retry: 0,
    testTimeout: 30000,
    hookTimeout: 30000,
    teardownTimeout: 30000
  }
});
