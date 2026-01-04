import cookieParser from "cookie-parser";
import express from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "../server/prisma";
import { registerAuthRoutes } from "../server/routes/auth";
import { createTestUser } from "./helpers";

// Setup express app for testing
const app = express();
app.use(express.json());
app.use(cookieParser());
registerAuthRoutes(app);

describe("Auth Integration", () => {
  beforeAll(async () => {
    // SAFETY: Prevent running tests against production DB
    const dbUrl = process.env.DATABASE_URL || "";
    if (dbUrl.includes("railway.app") || dbUrl.includes("prod") || dbUrl.includes("intranet")) {
      throw new Error("🚨 TESTS CANNOT RUN AGAINST PRODUCTION DATABASE! Set DATABASE_URL to a test database.");
    }

    // Note: Tests no longer clean database to prevent accidental data loss
    // Use a dedicated test database with seed data
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("POST /api/auth/login", () => {
    it("should login successfully with valid credentials", async () => {
      await createTestUser({ email: "login-test@example.com" });

      const response = await request(app).post("/api/auth/login").send({
        email: "login-test@example.com",
        password: "password123",
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("user");
      expect(response.body.user.email).toBe("login-test@example.com");
      // Check for cookie
      const rawCookies = response.headers["set-cookie"];
      const cookies = Array.isArray(rawCookies) ? rawCookies : rawCookies ? [rawCookies] : [];
      expect(cookies.length).toBeGreaterThan(0);
      expect(cookies.some((c: string) => c.includes("mp_session"))).toBe(true);
    });

    it("should fail with invalid password", async () => {
      await createTestUser({ email: "fail-test@example.com" });

      const response = await request(app).post("/api/auth/login").send({
        email: "fail-test@example.com",
        password: "wrongpassword",
      });

      expect(response.status).toBe(401);
    });

    it("should fail with non-existent user", async () => {
      const response = await request(app).post("/api/auth/login").send({
        email: "nonexistent@example.com",
        password: "password123",
      });

      expect(response.status).toBe(401);
    });
  });

  describe("POST /api/auth/logout", () => {
    it("should clear the token cookie", async () => {
      const response = await request(app).post("/api/auth/logout");

      expect(response.status).toBe(200);
      const rawCookies = response.headers["set-cookie"];
      const cookies = Array.isArray(rawCookies) ? rawCookies : rawCookies ? [rawCookies] : [];
      expect(cookies.length).toBeGreaterThan(0);
      // Expect token to be cleared (empty value or past expiry)
      expect(cookies.some((c: string) => c.includes("mp_session=;"))).toBe(true);
    });
  });
});
