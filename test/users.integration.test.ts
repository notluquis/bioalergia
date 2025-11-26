import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../server/index.js";
import { prisma } from "../server/prisma.js";
import { createTestUser, generateToken } from "./helpers.js";
import { sessionCookieName } from "../server/config.js";

describe("User Integration Tests", () => {
  let adminToken: string;
  let adminId: number;

  beforeAll(async () => {
    // Create admin user
    const admin = await createTestUser({ role: "ADMIN", email: "admin@test.com" });
    adminId = admin.id;
    adminToken = generateToken(admin);
  });

  afterAll(async () => {
    // Cleanup
    if (adminId) {
      await prisma.auditLog.deleteMany({ where: { userId: adminId } });
      await prisma.user.delete({ where: { id: adminId } });
    }
  });

  it("should log audit event when inviting a user", async () => {
    // Create a person first
    const person = await prisma.person.create({
      data: {
        names: "Test Person",
        rut: `12345678-${Math.floor(Math.random() * 9)}`,
        email: "invitee@test.com",
      },
    });

    const res = await request(app)
      .post("/api/users/invite")
      .set("Cookie", [`${sessionCookieName}=${adminToken}`])
      .send({
        personId: person.id,
        email: "invitee@test.com",
        role: "VIEWER",
      });

    expect(res.status).toBe(200);

    // Verify audit log
    const log = await prisma.auditLog.findFirst({
      where: {
        action: "USER_INVITE",
        details: {
          path: ["email"],
          equals: "invitee@test.com",
        },
      },
    });

    expect(log).toBeDefined();
    expect(log?.userId).toBe(adminId);
    expect(log?.entity).toBe("User");

    // Cleanup
    if (res.body.userId) {
      await prisma.user.delete({ where: { id: res.body.userId } });
    }
    await prisma.person.delete({ where: { id: person.id } });
  });
});
