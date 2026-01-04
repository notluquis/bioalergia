import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import dotenv from "dotenv";
import { afterEach, beforeAll, expect } from "vitest";

dotenv.config();

// 🚨 GLOBAL SAFETY CHECK: Prevent tests from running against production DB
beforeAll(() => {
  const dbUrl = process.env.DATABASE_URL || "";
  const isDangerous =
    dbUrl.includes("railway.app") ||
    dbUrl.includes("prod") ||
    dbUrl.includes("intranet") ||
    dbUrl.includes("bioalergia.cl");

  if (isDangerous) {
    throw new Error(
      `\n\n🚨🚨🚨 PRODUCTION DATABASE DETECTED! 🚨🚨🚨\n\n` +
        `DATABASE_URL points to production:\n${dbUrl}\n\n` +
        `Tests CANNOT run against production data.\n` +
        `Create a separate test database and set DATABASE_URL_TEST.\n\n` +
        `To run tests safely:\n` +
        `  1. Create a local Postgres: docker run -d -p 5433:5432 postgres\n` +
        `  2. Set DATABASE_URL=postgresql://postgres@localhost:5433/test\n` +
        `  3. Run: npx prisma migrate deploy\n` +
        `  4. Then: npm test\n\n` +
        `Aborting to protect production data.\n`
    );
  }
});

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Extend expect with custom matchers
declare module "vitest" {
  interface Assertion {
    toBeValidRut(): void;
  }
}

expect.extend({
  toBeValidRut(received: string) {
    const { validateRut } = require("../src/lib/rut");
    const pass = validateRut(received);
    return {
      pass,
      message: () => (pass ? `expected ${received} not to be a valid RUT` : `expected ${received} to be a valid RUT`),
    };
  },
});
