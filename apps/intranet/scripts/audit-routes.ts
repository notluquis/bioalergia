#!/usr/bin/env tsx

/**
 * Route Navigation Audit Script
 *
 * Validates that all page routes have proper navigation metadata.
 * Run with: pnpm audit:routes
 */

import { auditRouteNavigation } from "../src/lib/route-utils";
import { routeTree } from "../src/routeTree.gen";

function main() {
  console.log("🔍 Auditing route navigation metadata...\n");

  const audit = auditRouteNavigation(routeTree);

  console.log(`✅ Valid routes: ${audit.validRoutes.length}`);
  console.log(`🔧 Technical routes (auto-excluded): ${audit.technicalRoutes.length}`);
  console.log(`⚠️  Missing nav metadata: ${audit.missingNav.length}`);
  console.log(`⚠️  Missing permission: ${audit.missingPermission.length}\n`);

  if (audit.missingNav.length > 0) {
    console.log("❌ Routes missing nav metadata:");
    for (const route of audit.missingNav) {
      console.log(`   - ${route}`);
    }
    console.log("\n💡 Add staticData.nav or staticData.hideFromNav: true to these routes\n");
  }

  if (audit.missingPermission.length > 0) {
    console.log("❌ Routes missing permission:");
    for (const route of audit.missingPermission) {
      console.log(`   - ${route}`);
    }
    console.log("\n💡 Add staticData.permission to these routes\n");
  }

  if (audit.missingNav.length === 0 && audit.missingPermission.length === 0) {
    console.log("✨ All routes are properly configured!\n");
    process.exit(0);
  } else {
    console.log("⚠️  Some routes need attention. See above for details.\n");
    process.exit(1);
  }
}

main();
