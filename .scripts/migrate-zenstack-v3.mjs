#!/usr/bin/env node

/**
 * Auto-migration script for ZenStack v3.3.0 official pattern
 * Replaces old hook imports with new useClientQueries pattern
 */

import { readFileSync, writeFileSync } from "fs";

const files = [
  "apps/intranet/src/features/counterparts/pages/CounterpartsPage.tsx",
  "apps/intranet/src/features/finance/hooks/useFinancialSummary.ts",
  "apps/intranet/src/features/finance/mercadopago/components/ReleaseColumns.tsx",
  "apps/intranet/src/features/finance/mercadopago/components/SettlementColumns.tsx",
  "apps/intranet/src/features/finance/mercadopago/pages/ReleaseTransactionsPage.tsx",
  "apps/intranet/src/features/finance/mercadopago/pages/SettlementTransactionsPage.tsx",
  "apps/intranet/src/features/finance/types.ts",
  "apps/intranet/src/features/hr/employees/pages/EmployeesPage.tsx",
  "apps/intranet/src/features/inventory/components/InventoryCategoryManager.tsx",
  "apps/intranet/src/features/operations/inventory/pages/InventoryPage.tsx",
  "apps/intranet/src/features/payouts/api.ts",
  "apps/intranet/src/features/payouts/components/columns.tsx",
  "apps/intranet/src/features/users/pages/UserManagementPage.tsx",
];

const hookPatterns = [
  {
    from: /import\s+{\s*useFindMany(\w+)\s*}\s+from\s+["']@finanzas\/db\/hooks["'];?/g,
    model: true,
  },
  {
    from: /import\s+{\s*useFindUnique(\w+)\s*}\s+from\s+["']@finanzas\/db\/hooks["'];?/g,
    model: true,
  },
  {
    from: /import\s+{\s*useFindFirst(\w+)\s*}\s+from\s+["']@finanzas\/db\/hooks["'];?/g,
    model: true,
  },
  { from: /import\s+{\s*useCreate(\w+)\s*}\s+from\s+["']@finanzas\/db\/hooks["'];?/g, model: true },
  { from: /import\s+{\s*useUpdate(\w+)\s*}\s+from\s+["']@finanzas\/db\/hooks["'];?/g, model: true },
  { from: /import\s+{\s*useDelete(\w+)\s*}\s+from\s+["']@finanzas\/db\/hooks["'];?/g, model: true },
];

let migrated = 0;
let skipped = 0;

for (const file of files) {
  try {
    let content = readFileSync(file, "utf-8");
    let modified = false;

    // Check if already migrated
    if (content.includes("useClientQueries")) {
      console.log(`⏭️  Skipped (already migrated): ${file}`);
      skipped++;
      continue;
    }

    // Check if needs migration
    if (!content.includes("@finanzas/db/hooks")) {
      console.log(`⏭️  Skipped (no hooks): ${file}`);
      skipped++;
      continue;
    }

    // Add import if not present
    if (!content.includes("useClientQueries")) {
      if (content.includes("import { schemaLite }")) {
        content = content.replace(
          /import\s+{\s*schemaLite\s*}\s+from\s+["']@finanzas\/db["'];?/,
          'import { useClientQueries, schemaLite } from "@finanzas/db";',
        );
      } else if (content.includes("import type")) {
        // Add after first import
        const firstImport = content.match(/^import\s+.+from\s+["'].+["'];?$/m);
        if (firstImport) {
          content = content.replace(
            firstImport[0],
            `${firstImport[0]}\nimport { useClientQueries, schemaLite } from "@finanzas/db";`,
          );
        }
      } else {
        content = `import { useClientQueries, schemaLite } from "@finanzas/db";\n` + content;
      }
      modified = true;
    }

    // Remove old hook imports
    content = content.replace(/import\s+{[^}]*}\s+from\s+["']@finanzas\/db\/hooks["'];?\n?/g, "");
    modified = true;

    // Add client initialization in component/hook/function
    const functionMatch = content.match(
      /(export\s+(?:default\s+)?function\s+\w+|export\s+const\s+\w+\s*=\s*\([^)]*\)\s*=>)/,
    );
    if (functionMatch && !content.includes("const client = useClientQueries")) {
      // Find where to insert (after function declaration)
      const insertPoint = content.indexOf("{", content.indexOf(functionMatch[0])) + 1;
      const before = content.substring(0, insertPoint);
      const after = content.substring(insertPoint);
      content = before + "\n  const client = useClientQueries(schemaLite);\n" + after;
      modified = true;
    }

    // Replace hook calls
    content = content.replace(/useFindMany(\w+)\(/g, (match, model) => {
      const modelLower = model.charAt(0).toLowerCase() + model.slice(1);
      return `client.${modelLower}.useFindMany(`;
    });
    content = content.replace(/useFindUnique(\w+)\(/g, (match, model) => {
      const modelLower = model.charAt(0).toLowerCase() + model.slice(1);
      return `client.${modelLower}.useFindUnique(`;
    });
    content = content.replace(/useFindFirst(\w+)\(/g, (match, model) => {
      const modelLower = model.charAt(0).toLowerCase() + model.slice(1);
      return `client.${modelLower}.useFindFirst(`;
    });
    content = content.replace(/useCreate(\w+)\(/g, (match, model) => {
      const modelLower = model.charAt(0).toLowerCase() + model.slice(1);
      return `client.${modelLower}.useCreate(`;
    });
    content = content.replace(/useUpdate(\w+)\(/g, (match, model) => {
      const modelLower = model.charAt(0).toLowerCase() + model.slice(1);
      return `client.${modelLower}.useUpdate(`;
    });
    content = content.replace(/useDelete(\w+)\(/g, (match, model) => {
      const modelLower = model.charAt(0).toLowerCase() + model.slice(1);
      return `client.${modelLower}.useDelete(`;
    });

    if (modified) {
      writeFileSync(file, content, "utf-8");
      console.log(`✅ Migrated: ${file}`);
      migrated++;
    } else {
      console.log(`⏭️  Skipped (no changes): ${file}`);
      skipped++;
    }
  } catch (err) {
    console.error(`❌ Error in ${file}:`, err.message);
  }
}

console.log(`\n📊 Summary: ${migrated} migrated, ${skipped} skipped`);
