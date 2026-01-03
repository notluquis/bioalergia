import { beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "../prisma.js";
import { logAudit } from "./audit.js";

vi.mock("../prisma.js", () => ({
  prisma: {
    auditLog: {
      create: vi.fn(),
    },
  },
}));

describe("Audit Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create an audit log entry with all fields", async () => {
    const params = {
      userId: 1,
      action: "USER_INVITE" as const,
      entity: "User",
      entityId: "123",
      details: { email: "test@example.com" },
      ipAddress: "127.0.0.1",
    };

    await logAudit(params);

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: 1,
        action: "USER_INVITE",
        entity: "User",
        entityId: "123",
        details: { email: "test@example.com" },
        ipAddress: "127.0.0.1",
      },
    });
  });

  it("should handle missing optional fields", async () => {
    const params = {
      action: "SETTINGS_UPDATE" as const,
      entity: "Settings",
    };

    await logAudit(params);

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: undefined,
        action: "SETTINGS_UPDATE",
        entity: "Settings",
        entityId: null,
        details: undefined,
        ipAddress: undefined,
      },
    });
  });

  it("should log error but not throw if database fails", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(prisma.auditLog.create).mockRejectedValueOnce(new Error("DB Error"));

    await expect(logAudit({ action: "USER_SETUP", entity: "User" })).resolves.not.toThrow();

    expect(consoleSpy).toHaveBeenCalledWith("Failed to create audit log:", expect.any(Error));
    consoleSpy.mockRestore();
  });
});
