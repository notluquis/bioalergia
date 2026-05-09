import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../../../../packages/db/.env") });

async function main() {
  const { db } = await import("@finanzas/db");
  const tables = [
    "user",
    "person",
    "passkey",
    "role",
    "permission",
    "rolePermission",
    "userRoleAssignment",
    "outreachEstablishment",
    "outreachContact",
    "outreachInteraction",
    "waBusinessAccount",
    "waPhoneNumber",
    "waContact",
    "waConversation",
    "waMessage",
  ] as const;
  console.log("Conteos:");
  for (const t of tables) {
    try {
      const client = (db as unknown as Record<string, { count: () => Promise<number> }>)[t];
      const count = await client.count();
      console.log(`  ${t}: ${count}`);
    } catch (err) {
      console.log(`  ${t}: ERROR ${err instanceof Error ? err.message : err}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
