import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../../../../packages/db/.env") });

const SUBJECTS = ["WaBusinessAccount"] as const;
const ACTIONS = ["read", "create", "update", "delete"] as const;
const TARGET_ROLES = process.env.WA_SEED_ROLES?.split(",").map((s) => s.trim()).filter(Boolean) ??
  ["SystemAdministrator", "Admin", "Administrador", "Socio"];

async function main() {
  const { db } = await import("@finanzas/db");
  console.log("🌱 Seeding WhatsApp Cloud permissions...");
  const ids: number[] = [];
  for (const s of SUBJECTS) {
    for (const a of ACTIONS) {
      const existing = await db.permission.findFirst({ where: { action: a, subject: s } });
      if (existing) {
        ids.push(existing.id);
        continue;
      }
      const c = await db.permission.create({
        data: { action: a, subject: s, description: `${a} ${s}` },
      });
      console.log(`   + ${a}:${s} (id=${c.id})`);
      ids.push(c.id);
    }
  }
  const roles = await db.role.findMany({
    where: { OR: TARGET_ROLES.map((n) => ({ name: { equals: n, mode: "insensitive" as const } })) },
  });
  if (roles.length === 0) {
    console.log("⚠️  Sin roles match. Roles disponibles:");
    const all = await db.role.findMany({ select: { id: true, name: true } });
    for (const r of all) console.log(`   - ${r.id}: ${r.name}`);
    return;
  }
  for (const role of roles) {
    let added = 0;
    for (const permissionId of ids) {
      const exists = await db.rolePermission.findUnique({
        where: { roleId_permissionId: { roleId: role.id, permissionId } },
      });
      if (exists) continue;
      await db.rolePermission.create({ data: { roleId: role.id, permissionId } });
      added += 1;
    }
    console.log(`✅ Rol "${role.name}" (id=${role.id}): +${added} permisos`);
  }
  console.log("🎉 Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
