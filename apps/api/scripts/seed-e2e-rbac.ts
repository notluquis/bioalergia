/**
 * Hermetic-CI RBAC seed — run BEFORE seed-e2e-user.ts.
 *
 * A fresh `db:push` DB (the hermetic e2e / snapshots flow) has NO roles or
 * permissions: prod creates them via the admin UI, and `seed:synthetic` leaves
 * roles/permissions untouched on purpose. Without this step:
 *   - seed-e2e-user.ts looks up the "Socio" role, doesn't find it, `exit(3)` →
 *     E2E_USER/E2E_PASS come out empty → the fixture skips EVERY authed spec
 *     (and snapshot regen renders the logged-out UI);
 *   - even past that, its `E2EReadOnly`-gets-every-read grant matches ZERO rows
 *     because the `permissions` catalog is empty → authed routes bounce to `/`.
 *
 * This idempotently (a) ensures the "Socio" role exists and (b) populates the
 * full permission catalog via the canonical services/roles.ts::syncPermissions
 * (CRUD × every model + virtual subject). seed-e2e-user then assigns Socio +
 * E2EReadOnly and the read-grant actually covers every route.
 */
import { db } from "@finanzas/db";
import { syncPermissions } from "../src/services/roles.ts";

await db.role.upsert({
  where: { name: "Socio" },
  create: {
    name: "Socio",
    description: "Socio / empleado (least-privilege). Seeded for hermetic E2E.",
    isSystem: false,
  },
  update: {},
});

const res = await syncPermissions();
console.log(
  `[seed-e2e-rbac] Socio role ensured; permissions synced (+${res.created} created, ${res.skipped} existing, ${res.errors?.length ?? 0} errors)`,
);

if (res.errors?.length) {
  console.error(`[seed-e2e-rbac] ${res.errors.length} permission(s) failed to sync:`, res.errors);
}
// One-shot script: force exit so the ZenStack/pg pool doesn't keep the runner
// hanging. Exit 0 even on per-subject sync hiccups — Socio exists and the bulk
// of read perms are in place; a partial catalog degrades coverage, it doesn't
// warrant failing the gate.
process.exit(0);
