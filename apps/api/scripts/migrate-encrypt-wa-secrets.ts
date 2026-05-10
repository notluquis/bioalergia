#!/usr/bin/env tsx
// One-shot CLI: encrypt all plaintext WaBusinessAccount secrets in-place.
// Safe to run multiple times (idempotent — already-encrypted rows are skipped).
//
// Usage:
//   WA_SECRET_KEY=$(openssl rand -hex 32) DATABASE_URL=... pnpm tsx \
//     apps/api/scripts/migrate-encrypt-wa-secrets.ts
//
// IMPORTANT: persist WA_SECRET_KEY in Railway env BEFORE running this. Once
// encrypted, the values are unreadable without the same key. Losing the key
// = losing access to Meta API; you would need to re-enter the secrets via
// the Settings UI.

import { db } from "@finanzas/db";
import { ensureEncrypted, isEncrypted } from "../src/lib/secret-cipher.ts";

async function main() {
  if (!process.env.WA_SECRET_KEY) {
    console.error("WA_SECRET_KEY env var is required (32 bytes hex or base64).");
    process.exit(1);
  }
  const accounts = await db.waBusinessAccount.findMany({
    select: {
      id: true,
      wabaId: true,
      systemUserToken: true,
      appSecret: true,
      webhookVerifyToken: true,
    },
  });
  let updated = 0;
  for (const a of accounts) {
    const next = {
      systemUserToken: ensureEncrypted(a.systemUserToken),
      appSecret: ensureEncrypted(a.appSecret),
      webhookVerifyToken: ensureEncrypted(a.webhookVerifyToken),
    };
    const changed =
      next.systemUserToken !== a.systemUserToken ||
      next.appSecret !== a.appSecret ||
      next.webhookVerifyToken !== a.webhookVerifyToken;
    const status = {
      token: a.systemUserToken
        ? isEncrypted(a.systemUserToken)
          ? "already-enc"
          : "plain→enc"
        : "null",
      secret: a.appSecret
        ? isEncrypted(a.appSecret)
          ? "already-enc"
          : "plain→enc"
        : "null",
      verify: a.webhookVerifyToken
        ? isEncrypted(a.webhookVerifyToken)
          ? "already-enc"
          : "plain→enc"
        : "null",
    };
    console.log(`account ${a.id} (waba=${a.wabaId}):`, status);
    if (changed) {
      await db.waBusinessAccount.update({ where: { id: a.id }, data: next });
      updated++;
    }
  }
  console.log(`\nDone. ${updated} of ${accounts.length} accounts updated.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
