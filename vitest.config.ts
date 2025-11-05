import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    // Vitest 4.0: No poolOptions, use top-level config
    maxWorkers: 4,
    isolate: true,
    environment: "jsdom",

    // Coverage with explicit includes (required in v4)
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}", "server/**/*.ts", "shared/**/*.ts"],
      exclude: [
        "**/*.test.ts",
        "**/*.test.tsx",
        "**/*.spec.ts",
        "**/types.ts",
        "server/migrations/**",
        "**/index.ts",
        "**/*.d.ts",
        "generated/**",
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
      reporter: ["text", "json", "html"],
    },

    // Setup files
    setupFiles: ["./test/setup.ts"],

    // Reporters (v4 default)
    reporters: ["default"],

    // Globals for easier testing
    globals: true,
  },
});
