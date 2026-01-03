import cookieParser from "cookie-parser";
import express from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "../server/prisma";
// We need to register finance routes.
// Assuming server/routes/finance.ts exists and exports registerFinanceRoutes or similar.
// Let's check if we can import the router or registration function.
import { registerTransactionRoutes } from "../server/routes/transactions";
import { createTestUser, generateToken } from "./helpers";

// Setup express app
const app = express();
app.use(express.json());
app.use(cookieParser());
// Mock auth middleware or use real one?
// The real one uses `authenticate` which verifies token.
// We need to register auth routes to issue token? No, we can generate token manually.
// But we need `authenticate` middleware to work.
// `authenticate` reads cookie.
// We need to register transaction routes.
registerTransactionRoutes(app);

describe("Finance Integration", () => {
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

  describe("GET /api/transactions", () => {
    it("should return empty list when no transactions exist", async () => {
      const user = await createTestUser({ email: "finance-test@example.com" });
      const token = generateToken(user);

      const response = await request(app)
        .get("/api/transactions")
        .set("Cookie", [`token=${token}`]);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(0);
      expect(response.body.total).toBe(0);
    });

    it("should return transactions when they exist", async () => {
      const user = await createTestUser({ email: "finance-test-2@example.com" });
      const token = generateToken(user);

      // Seed transaction
      await prisma.transaction.create({
        data: {
          amount: 10000,
          timestamp: new Date(),
          direction: "OUT",
          description: "Test Transaction",
          personId: user.personId,
        },
      });

      const response = await request(app)
        .get("/api/transactions")
        .set("Cookie", [`token=${token}`]);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].amount).toBe(10000);
      expect(response.body.data[0].description).toBe("Test Transaction");
    });

    it("should fail without authentication", async () => {
      const response = await request(app).get("/api/transactions");
      expect(response.status).toBe(401);
    });
  });
});
