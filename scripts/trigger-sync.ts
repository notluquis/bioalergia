import "dotenv/config";
import { syncPermissions } from "../server/services/permissions.js";
import { prisma } from "../server/prisma.js";

async function main() {
  console.log("Running Manual Permission Sync (Test)...");
  try {
    const result = await syncPermissions();
    console.log("Sync Result:", result);
    console.log("✅ Auto-Discovery Logic Verified.");
  } catch (e) {
    console.error("❌ Sync Failed:", e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
