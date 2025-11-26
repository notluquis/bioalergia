import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../server/index.js";
import { prisma } from "../server/prisma.js";
import { createTestUser, generateToken } from "./helpers.js";
import { sessionCookieName } from "../server/config.js";

describe("Settings Integration Tests", () => {
  let adminToken: string;
  let adminId: number;

  beforeAll(async () => {
    const admin = await createTestUser({ role: "ADMIN", email: "settings-admin@test.com" });
    adminId = admin.id;
    adminToken = generateToken(admin);
  });

  afterAll(async () => {
    if (adminId) {
      await prisma.auditLog.deleteMany({ where: { userId: adminId } });
      await prisma.user.delete({ where: { id: adminId } });
    }
  });

  it("should log audit event when updating settings", async () => {
    const payload = {
      orgName: "Updated Company",
      orgAddress: "123 Test St",
      primaryColor: "#000000",
      secondaryColor: "#ffffff",
      pageTitle: "Test Title",
      dbDisplayHost: "localhost",
      dbDisplayName: "Test DB",
      supportEmail: "support@test.com",
      logoUrl: "https://example.com/logo.png",
      faviconUrl: "https://example.com/favicon.ico",
    };

    const res = await request(app)
      .put("/api/settings")
      .set("Cookie", [`${sessionCookieName}=${adminToken}`])
      .send(payload);

    expect(res.status).toBe(200);

    const log = await prisma.auditLog.findFirst({
      where: {
        action: "SETTINGS_UPDATE",
        userId: adminId,
      },
      orderBy: { createdAt: "desc" },
    });

    expect(log).toBeDefined();
    expect(log?.entity).toBe("Settings");
    const details = log?.details as Record<string, unknown>;
    expect(details.orgName).toBe("Updated Company");
  });
});
