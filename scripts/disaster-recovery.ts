/**
 * Disaster Recovery Script
 *
 * Restores database from:
 * 1. Last full backup (Sunday snapshots)
 * 2. Incremental audit logs (JSONL files)
 *
 * Usage: npx tsx scripts/disaster-recovery.ts --date 2026-01-02
 */

import { prisma } from "../server/prisma.js";
import { listBackups, downloadFromDrive } from "../server/services/backup/drive.js";
import { restoreFromBackup } from "../server/services/backup/backup.js";
import { createReadStream } from "fs";
import { createInterface } from "readline";
import { tmpdir } from "os";
import { join } from "path";

interface AuditLogEntry {
  id: string;
  table: string;
  row_id: string;
  op: "INSERT" | "UPDATE" | "DELETE";
  old: Record<string, unknown> | null;
  new: Record<string, unknown> | null;
  ts: string;
}

async function findLatestFullBackup(): Promise<{ id: string; name: string; date: Date } | null> {
  const backups = await listBackups();

  // Find backups that are full (not audit_*.jsonl)
  const fullBackups = backups.filter((b) => !b.name.startsWith("audit_"));

  if (fullBackups.length === 0) return null;

  // Sort by date descending
  fullBackups.sort((a, b) => new Date(b.createdTime).getTime() - new Date(a.createdTime).getTime());

  return {
    id: fullBackups[0].id,
    name: fullBackups[0].name,
    date: new Date(fullBackups[0].createdTime),
  };
}

async function findIncrementalsSince(date: Date): Promise<Array<{ id: string; name: string; date: Date }>> {
  const backups = await listBackups();

  // Find audit JSONL files after the given date
  return backups
    .filter((b) => b.name.startsWith("audit_") && new Date(b.createdTime) > date)
    .map((b) => ({
      id: b.id,
      name: b.name,
      date: new Date(b.createdTime),
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime()); // Oldest first
}

async function applyIncrementalLog(filepath: string): Promise<number> {
  const stream = createReadStream(filepath);
  const rl = createInterface({ input: stream, crlfDelay: Infinity });

  let applied = 0;

  for await (const line of rl) {
    if (!line.trim()) continue;

    try {
      const entry: AuditLogEntry = JSON.parse(line);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const model = (prisma as any)[entry.table];
      if (!model) continue;

      // Parse ID (could be int or string)
      const rowId = /^\d+$/.test(entry.row_id) ? parseInt(entry.row_id, 10) : entry.row_id;

      switch (entry.op) {
        case "INSERT":
          // Re-create the row with the new data
          if (entry.new) {
            await model.upsert({
              where: { id: rowId },
              create: entry.new,
              update: entry.new,
            });
            applied++;
          }
          break;

        case "UPDATE":
          // Apply the update
          if (entry.new) {
            await model
              .update({
                where: { id: rowId },
                data: entry.new,
              })
              .catch(() => null); // Ignore if row doesn't exist
            applied++;
          }
          break;

        case "DELETE":
          // Delete the row
          await model
            .delete({
              where: { id: rowId },
            })
            .catch(() => null); // Ignore if already deleted
          applied++;
          break;
      }
    } catch (error) {
      console.warn(`Failed to apply entry: ${error}`);
    }
  }

  return applied;
}

async function runRecovery() {
  console.log("🔄 Starting Disaster Recovery...\n");

  // Step 1: Find latest full backup
  console.log("📦 Step 1: Finding latest full backup...");
  const fullBackup = await findLatestFullBackup();

  if (!fullBackup) {
    console.error("❌ No full backup found!");
    process.exit(1);
  }

  console.log(`   Found: ${fullBackup.name} (${fullBackup.date.toISOString()})`);

  // Step 2: Download and restore full backup
  console.log("\n📥 Step 2: Downloading full backup...");
  const tempPath = join(tmpdir(), fullBackup.name);
  await downloadFromDrive(fullBackup.id, tempPath);

  console.log("   Restoring from full backup...");
  await restoreFromBackup(tempPath);
  console.log("   ✅ Full backup restored");

  // Step 3: Find and apply incrementals
  console.log("\n📋 Step 3: Finding incremental logs...");
  const incrementals = await findIncrementalsSince(fullBackup.date);

  if (incrementals.length === 0) {
    console.log("   No incremental logs found after full backup");
  } else {
    console.log(`   Found ${incrementals.length} incremental logs`);

    let totalApplied = 0;
    for (const inc of incrementals) {
      console.log(`   Applying ${inc.name}...`);
      const incPath = join(tmpdir(), inc.name);
      await downloadFromDrive(inc.id, incPath);
      const applied = await applyIncrementalLog(incPath);
      totalApplied += applied;
      console.log(`     ✅ Applied ${applied} changes`);
    }

    console.log(`\n   Total changes applied: ${totalApplied}`);
  }

  console.log("\n✅ Recovery complete!");
  await prisma.$disconnect();
}

// Only run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runRecovery().catch((error) => {
    console.error("❌ Recovery failed:", error);
    process.exit(1);
  });
}

export { runRecovery, findLatestFullBackup, findIncrementalsSince, applyIncrementalLog };
