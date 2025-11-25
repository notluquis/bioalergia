import { execSync } from "child_process";

console.log("🛠️  Fixing deployment: Baselining database...");

try {
  // 1. Resolve the first migration (assumed to be the base state or close to it)
  // We ignore errors in case it's already applied (though P3005 suggests it's not known)
  try {
    console.log("👉 Resolving migration: 20251125044627_restore_calendar_models");
    execSync("npx prisma migrate resolve --applied 20251125044627_restore_calendar_models", { stdio: "inherit" });
  } catch {
    console.log(
      "⚠️  Could not resolve 20251125044627_restore_calendar_models (might be already applied or failed). Continuing..."
    );
  }

  // 2. Resolve the second migration
  try {
    console.log("👉 Resolving migration: 20251125045120_restore_inventory_production");
    execSync("npx prisma migrate resolve --applied 20251125045120_restore_inventory_production", { stdio: "inherit" });
  } catch {
    console.log("⚠️  Could not resolve 20251125045120_restore_inventory_production. Continuing...");
  }

  // 3. Run migrate deploy to apply any future migrations or verify state
  console.log("🚀 Running prisma migrate deploy...");
  execSync("npx prisma migrate deploy", { stdio: "inherit" });

  console.log("✅ Deployment fix completed successfully.");
} catch (error) {
  console.error("❌ Deployment fix failed:", error);
  process.exit(1);
}
