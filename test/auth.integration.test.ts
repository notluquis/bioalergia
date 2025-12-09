import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import express from "express";
import { prisma } from "../server/prisma";
import { createTestUser } from "./helpers";
import cookieParser from "cookie-parser";
import { registerAuthRoutes } from "../server/routes/auth";

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

    // Clean up database before tests
    await prisma.user.deleteMany();
    await prisma.person.deleteMany();
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
      const cookies = response.headers["set-cookie"];
      expect(cookies).toBeDefined();
      expect(cookies.some((c: string) => c.includes("token"))).toBe(true);
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
      const cookies = response.headers["set-cookie"];
      expect(cookies).toBeDefined();
      // Expect token to be cleared (empty value or past expiry)
      expect(cookies.some((c: string) => c.includes("token=;"))).toBe(true);
    });
  });
});
