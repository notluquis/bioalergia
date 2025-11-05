import { expect, afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

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
