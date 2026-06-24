#!/usr/bin/env tsx
// Idempotent CLI: encrypt all WaBusinessAccount secrets in-place. Doubles
// as a key-rotation tool — values already encrypted with an older key are
// re-encrypted with the current WA_SECRET_KEY.
//
// Usage:
//   # First-time encryption rollout
//   WA_SECRET_KEY=$(openssl rand -hex 32) DATABASE_URL=... \
//     node apps/api/scripts/migrate-encrypt-wa-secrets.ts
//
//   # Key rotation: keep old key available for decrypt, set new for write
//   WA_SECRET_KEY=$NEW_KEY \
//   WA_SECRET_KEYS_OLD=$OLD_KEY \
//   DATABASE_URL=... \
//     node apps/api/scripts/migrate-encrypt-wa-secrets.ts
//
//   # After all rows show key id = fingerprint(NEW_KEY) you can drop
//   # WA_SECRET_KEYS_OLD from the env. (Plaintext fallback is preserved
//   # for legacy values that were never encrypted.)
//
// IMPORTANT: persist WA_SECRET_KEY in Railway BEFORE running. Once
// encrypted, the values are unreadable without the same key. Losing the
// key = losing access to Meta API; you would need to re-enter the secrets
// via the Settings UI.

import { db } from "@finanzas/db";
import { ensureEncrypted, isEncrypted, keyIdOf } from "../src/lib/secret-cipher.ts";

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
  const summarize = (val: string | null) => {
    if (!val) return "null";
    if (!isEncrypted(val)) return "plain→enc";
    const id = keyIdOf(val);
    return id ? `enc:v2:${id}` : "enc:v1";
  };
  for (const a of accounts) {
    const next = {
      systemUserToken: ensureEncrypted(a.systemUserToken),
      appSecret: ensureEncrypted(a.appSecret),
      webhookVerifyToken: ensureEncrypted(a.webhookVerifyToken),
    };
    const before = {
      token: summarize(a.systemUserToken),
      secret: summarize(a.appSecret),
      verify: summarize(a.webhookVerifyToken),
    };
    const after = {
      token: summarize(next.systemUserToken),
      secret: summarize(next.appSecret),
      verify: summarize(next.webhookVerifyToken),
    };
    const changed =
      next.systemUserToken !== a.systemUserToken ||
      next.appSecret !== a.appSecret ||
      next.webhookVerifyToken !== a.webhookVerifyToken;
    console.log(`account ${a.id} (waba=${a.wabaId}):`, before, "→", after);
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
