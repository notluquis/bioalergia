import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import { registerSettingsRoutes } from "../server/routes/settings.js";

// Mock Services
vi.mock("../server/services/settings.js", () => ({
  getSettings: vi.fn().mockResolvedValue({ companyName: "Old Name" }),
  updateSettings: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../server/services/audit.js", () => ({
  logAudit: vi.fn(),
}));

// Mock Auth Middleware
vi.mock("../server/lib/http.js", async () => {
  const actual = await vi.importActual("../server/lib/http.js");
  return {
    ...actual,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    authenticate: vi.fn((req: any, res: any, next: any) => {
      req.auth = { userId: 1, email: "admin@example.com", role: "GOD" };
      next();
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    requireRole: () => (req: any, res: any, next: any) => next(),
  };
});

import { logAudit } from "../server/services/audit.js";
import { updateSettings } from "../server/services/settings.js";

const app = express();
app.use(express.json());
registerSettingsRoutes(app);

describe("Settings Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should update settings and log audit", async () => {
    const payload = {
      orgName: "Test Org",
      primaryColor: "#000000",
      secondaryColor: "#ffffff",
      logoUrl: "https://example.com/logo.png",
      faviconUrl: "https://example.com/favicon.ico",
      pageTitle: "Test Page",
      dbDisplayHost: "localhost",
      dbDisplayName: "Test DB",
      supportEmail: "test@example.com",
    };
    const res = await request(app).put("/api/settings").send(payload);

    expect(res.status).toBe(200);
    expect(updateSettings).toHaveBeenCalledWith(expect.objectContaining(payload));
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "SETTINGS_UPDATE",
        entity: "Settings",
        details: expect.objectContaining(payload),
      })
    );
  });
});
