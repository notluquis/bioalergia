import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { getOAuthClientBase } from "../lib/google/google-core";
import { db } from "@finanzas/db";

const OAUTH_TOKEN_KEY = "GOOGLE_OAUTH_REFRESH_TOKEN";

export const integrationRoutes = new Hono();

import { randomBytes } from "crypto";

// 1. Get Auth URL
integrationRoutes.get("/google/url", async (c) => {
  try {
    const oauth2Client = await getOAuthClientBase();

    // Generate random state for CSRF protection
    const state = randomBytes(32).toString("hex");

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: ["https://www.googleapis.com/auth/drive.file"],
      prompt: "consent", // Force refresh token generation
      state, // Required by Google security policy
    });

    return c.json({ url: authUrl });
  } catch (error) {
    console.error("Error generating auth url", error);
    return c.json({ error: "Failed to generate auth URL" }, 500);
  }
});

// 2. Exchange Code
integrationRoutes.post(
  "/google/connect",
  zValidator(
    "json",
    z.object({
      code: z.string().min(1),
    })
  ),
  async (c) => {
    const { code } = c.req.valid("json");

    try {
      const oauth2Client = await getOAuthClientBase();
      const { tokens } = await oauth2Client.getToken(code);

      if (!tokens.refresh_token) {
        return c.json(
          {
            error:
              "No refresh token returned. Did you already authorize? Revoke access and try again.",
          },
          400
        );
      }

      // Save to DB
      await db.setting.upsert({
        where: { key: OAUTH_TOKEN_KEY },
        create: {
          key: OAUTH_TOKEN_KEY,
          value: tokens.refresh_token,
        },
        update: {
          value: tokens.refresh_token,
        },
      });

      return c.json({ success: true });
    } catch (error) {
      console.error("Error exchanging code", error);
      return c.json({ error: "Failed to exchange code for token" }, 500);
    }
  }
);

// 3. Disconnect
integrationRoutes.delete("/google/disconnect", async (c) => {
  try {
    await db.setting
      .delete({
        where: { key: OAUTH_TOKEN_KEY },
      })
      .catch(() => {
        // Ignore if not found
      });

    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: "Failed to disconnect" }, 500);
  }
});

// 4. Status
integrationRoutes.get("/google/status", async (c) => {
  const setting = await db.setting.findUnique({
    where: { key: OAUTH_TOKEN_KEY },
  });

  return c.json({
    configured: !!setting || !!process.env.GOOGLE_OAUTH_REFRESH_TOKEN,
    source: setting
      ? "db"
      : process.env.GOOGLE_OAUTH_REFRESH_TOKEN
        ? "env"
        : "none",
  });
});
