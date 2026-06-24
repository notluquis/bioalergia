import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Pin to the production server timezone (Railway api: TZ=America/Santiago).
    // Date/time logic is TZ-sensitive; without this, tests pass or fail based on
    // the developer/CI machine's ambient TZ and TZ bugs slip through (see the
    // work_date rollback + @db.Time -3h display bugs, 2026-06-05).
    env: { TZ: "America/Santiago" },
  },
});
