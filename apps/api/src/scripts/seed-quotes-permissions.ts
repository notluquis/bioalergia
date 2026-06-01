import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../../../../packages/db/.env") });

const SUBJECTS = ["Company", "QuoteProduct", "Quote"] as const;
const ACTIONS = ["read", "create", "update", "delete"] as const;

const TARGET_ROLES = process.env.QUOTES_SEED_ROLES?.split(",")
  .map((s) => s.trim())
  .filter(Boolean) ?? ["SystemAdministrator", "Admin", "Administrador", "GOD"];

async function main() {
  const { db } = await import("@finanzas/db");

  console.log("🌱 Seeding Quotes permissions...");

  const permIds: number[] = [];
  for (const subject of SUBJECTS) {
    for (const action of ACTIONS) {
      const existing = await db.permission.findFirst({ where: { action, subject } });
      if (existing) {
        permIds.push(existing.id);
        continue;
      }
      const created = await db.permission.create({
        data: { action, subject, description: `${action} ${subject}` },
      });
      console.log(`   + Permiso ${action}:${subject} (id=${created.id})`);
      permIds.push(created.id);
    }
  }
  console.log(`✅ ${permIds.length} permisos disponibles`);

  const roles = await db.role.findMany({
    where: {
      OR: TARGET_ROLES.map((n) => ({ name: { equals: n, mode: "insensitive" as const } })),
    },
  });

  if (roles.length === 0) {
    console.log(`⚠️  Sin roles que coincidan con ${TARGET_ROLES.join(", ")}.`);
    const all = await db.role.findMany({ select: { id: true, name: true } });
    for (const r of all) console.log(`   - ${r.id}: ${r.name}`);
    console.log("   Re-ejecuta con QUOTES_SEED_ROLES='NombreRol' env var.");
    return;
  }

  for (const role of roles) {
    let added = 0;
    for (const permissionId of permIds) {
      const exists = await db.rolePermission.findUnique({
        where: { roleId_permissionId: { roleId: role.id, permissionId } },
      });
      if (exists) continue;
      await db.rolePermission.create({ data: { roleId: role.id, permissionId } });
      added += 1;
    }
    console.log(`✅ Rol "${role.name}" (id=${role.id}): +${added} permisos asignados`);
  }

  console.log("🎉 Done.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
