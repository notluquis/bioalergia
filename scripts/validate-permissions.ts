#!/usr/bin/env tsx
/**
 * Permission Validation Script
 *
 * Validates that all permissions used in routes are defined in the backend.
 * Run this during CI/CD to catch permission mismatches before deployment.
 *
 * Usage:
 *   pnpm validate:permissions
 */

import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// Load Route Data
// ============================================================================

async function loadRouteData() {
  const routeDataPath = path.resolve(__dirname, "../apps/web/shared/route-data.ts");
  // Use dynamic import to load the ES module
  const { ROUTE_DATA, API_PERMISSIONS } = await import(routeDataPath);
  return { ROUTE_DATA, API_PERMISSIONS };
}

// ============================================================================
// Extract Permissions from Routes
// ============================================================================

interface RoutePermission {
  action: string;
  subject: string;
}

function extractPermissionsFromRoutes(routes: any[], path = ""): Set<string> {
  const subjects = new Set<string>();

  for (const route of routes) {
    // Add permission subject if it exists
    if (route.permission?.subject) {
      subjects.add(route.permission.subject);
    }

    // Recursively process children
    if (route.children) {
      const childSubjects = extractPermissionsFromRoutes(route.children, path);
      childSubjects.forEach((s) => {
        subjects.add(s);
      });
    }
  }

  return subjects;
}

// ============================================================================
// Backend Subjects (Hardcoded for validation)
// ============================================================================

// NOTE: This is duplicated from apps/api/src/services/roles.ts
// Keep in sync manually or import from a shared location
const BACKEND_SUBJECTS = [
  "User",
  "Transaction",
  "Setting",
  "Role",
  "Permission",
  "Person",
  "Counterpart",
  "Loan",
  "Service",
  "InventoryItem",
  "ProductionBalance",
  "CalendarEvent",
  "Employee",
  "Timesheet",
  "Report",
  "SupplyRequest",
  "Dashboard",
  "Backup",
  "BulkData",
  "DailyBalance",
  "CalendarSetting",
  "InventorySetting",
  "Integration",
  "CalendarSchedule",
  "CalendarDaily",
  "CalendarHeatmap",
  "CalendarSyncLog",
  "TransactionList",
  "TransactionStats",
  "TransactionCSV",
  "ServiceList",
  "ServiceAgenda",
  "ServiceTemplate",
  "TimesheetList",
  "TimesheetAudit",
  "SyncLog",
  "ReleaseTransaction",
];

// ============================================================================
// Validation Logic
// ============================================================================

async function validate() {
  console.log("🔍 Validating permissions...\n");

  // Load route data
  const { ROUTE_DATA, API_PERMISSIONS } = await loadRouteData();

  // Extract frontend permissions
  const frontendSubjects = extractPermissionsFromRoutes(ROUTE_DATA);

  // Add API-only permissions
  API_PERMISSIONS.forEach((p: RoutePermission) => {
    frontendSubjects.add(p.subject);
  });

  // Backend permissions
  const backendSubjects = new Set(BACKEND_SUBJECTS);

  // ============================================================================
  // Check 1: Undefined Permissions (CRITICAL)
  // ============================================================================
  const undefinedPermissions = Array.from(frontendSubjects).filter((s) => !backendSubjects.has(s));

  if (undefinedPermissions.length > 0) {
    console.error("❌ CRITICAL: Permissions used in routes but NOT defined in backend:\n");
    undefinedPermissions.forEach((s) => {
      console.error(`   - ${s}`);
    });
    console.error("\n💡 Fix: Add these to apps/api/src/services/roles.ts\n");
    process.exit(1);
  } else {
    console.log("✅ All frontend permissions are defined in backend");
  }

  // ============================================================================
  // Check 2: Duplicate Permissions in Backend (WARNING)
  // ============================================================================
  const seen = new Set<string>();
  const duplicates: string[] = [];

  for (const subject of BACKEND_SUBJECTS) {
    if (seen.has(subject)) {
      duplicates.push(subject);
    }
    seen.add(subject);
  }

  if (duplicates.length > 0) {
    console.warn("\n⚠️  WARNING: Duplicate permissions in backend:\n");
    duplicates.forEach((s) => {
      console.warn(`   - ${s}`);
    });
    console.warn("\n💡 Fix: Remove duplicates from apps/api/src/services/roles.ts\n");
    // Don't exit - this is just a warning
  }

  // ============================================================================
  // Check 3: Unused Permissions (INFO)
  // ============================================================================
  const unused = Array.from(backendSubjects).filter((s) => !frontendSubjects.has(s));

  if (unused.length > 0) {
    console.log("\nℹ️  Permissions defined but not used in routes (may be OK):\n");
    unused.forEach((s) => {
      console.log(`   - ${s}`);
    });
    console.log("\n💡 Note: These may be used in component-level checks or API endpoints\n");
  }

  // ============================================================================
  // Summary
  // ============================================================================
  console.log("━".repeat(60));
  console.log("📊 Summary:");
  console.log(`   Backend permissions: ${backendSubjects.size}`);
  console.log(`   Frontend used: ${frontendSubjects.size}`);
  console.log(`   Undefined: ${undefinedPermissions.length}`);
  console.log(`   Duplicates: ${duplicates.length}`);
  console.log(`   Unused: ${unused.length}`);
  console.log("━".repeat(60));

  if (undefinedPermissions.length === 0) {
    console.log("\n✅ Permission validation passed!\n");
    process.exit(0);
  }
}

// Run validation
validate().catch((error) => {
  console.error("\n❌ Validation script error:", error);
  process.exit(1);
});
