// Restore from backup_*.json[.gz] produced by services/backups.ts
//
// Usage:
//   pnpm tsx src/scripts/restore-backup.ts /path/to/backup.json[.gz] [--dry] [--truncate] [--tables=A,B]

import { createReadStream, existsSync, statSync } from "node:fs";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";
import { createGunzip } from "node:zlib";
import { config } from "dotenv";
import parser from "stream-json/parser.js";
import pick from "stream-json/filters/pick.js";
import streamArray from "stream-json/streamers/stream-array.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolvePath(__dirname, "../../../../packages/db/.env"), override: true });

function inputStream(path: string) {
  const isGz = path.toLowerCase().endsWith(".gz");
  const base = createReadStream(path);
  return isGz ? base.pipe(createGunzip()) : base;
}

function fmtBytes(n: number) {
  if (n > 1024 * 1024 * 1024) return (n / 1024 / 1024 / 1024).toFixed(2) + " GB";
  if (n > 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + " MB";
  return (n / 1024).toFixed(0) + " KB";
}

function fmtTime(ms: number) {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  return `${m}m${rs}s`;
}

// Read file's start to extract the `tables` array from the header.
// Header shape: {"version":"1.0","createdAt":"...","engine":"...","tables":["A","B",...],"data":...}
async function readHeaderTables(path: string): Promise<string[]> {
  return new Promise((resolveP, rejectP) => {
    const stream = inputStream(path);
    let buffer = "";
    let resolved = false;
    stream.on("data", (chunk: Buffer) => {
      buffer += chunk.toString("utf8");
      const m = buffer.match(/"tables"\s*:\s*\[([^\]]*)\]/);
      if (m && !resolved) {
        resolved = true;
        const names = (m[1] ?? "")
          .split(",")
          .map((s) => s.trim().replace(/^"|"$/g, ""))
          .filter(Boolean);
        stream.destroy();
        resolveP(names);
      }
    });
    stream.on("end", () => {
      if (!resolved) rejectP(new Error("No `tables` array found in header"));
    });
    stream.on("error", rejectP);
  });
}

async function* streamModelRows(
  path: string,
  modelName: string,
  chunkSize: number,
): AsyncGenerator<unknown[]> {
  const pipeline = inputStream(path)
    .pipe(parser.asStream())
    .pipe(pick.asStream({ filter: `data.${modelName}` }))
    .pipe(streamArray.asStream());
  let buffer: unknown[] = [];
  for await (const item of pipeline as AsyncIterable<{ value: unknown }>) {
    buffer.push(item.value);
    if (buffer.length >= chunkSize) {
      yield buffer;
      buffer = [];
    }
  }
  if (buffer.length > 0) yield buffer;
}

// Stream rows + report bytes processed for ETA.
async function* streamModelRowsWithProgress(
  path: string,
  modelName: string,
  chunkSize: number,
  onBytes: (delta: number) => void,
): AsyncGenerator<unknown[]> {
  const isGz = path.toLowerCase().endsWith(".gz");
  const base = createReadStream(path);
  base.on("data", (c: Buffer) => onBytes(c.length));
  const upstream = isGz ? base.pipe(createGunzip()) : base;
  const pipeline = upstream
    .pipe(parser.asStream())
    .pipe(pick.asStream({ filter: `data.${modelName}` }))
    .pipe(streamArray.asStream());
  let buffer: unknown[] = [];
  for await (const item of pipeline as AsyncIterable<{ value: unknown }>) {
    buffer.push(item.value);
    if (buffer.length >= chunkSize) {
      yield buffer;
      buffer = [];
    }
  }
  if (buffer.length > 0) yield buffer;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const path = args.find((a) => !a.startsWith("--"));
  const tables = args.find((a) => a.startsWith("--tables="))?.slice(9).split(",").filter(Boolean);
  const truncate = args.includes("--truncate");
  const dry = args.includes("--dry");
  const preflight = args.includes("--preflight");
  if (!path) {
    console.error("Uso: restore-backup.ts <ruta.json[.gz]> [--tables=A,B] [--truncate] [--dry] [--preflight]");
    process.exit(1);
  }
  return { path, tablesFilter: tables, truncate, dry, preflight };
}

const ORDER_HINT = [
  "Person",
  "User",
  "Permission",
  "Role",
  "RolePermission",
  "UserRoleAssignment",
  "UserPermissionVersion",
  "Passkey",
  "DebugToken",
  "Patient",
  "Setting",
  "OneDriveAccount",
  "OneDriveWatchChannel",
  "Calendar",
  "CalendarWatchChannel",
  "Counterpart",
  "CounterpartAccount",
  "Service",
  "ServiceSchedule",
  "Employee",
  "EmployeeTimesheet",
  "AttendanceMark",
  "OfficeNetwork",
  "SettlementTransaction",
  "ReleaseTransaction",
  "WithdrawTransaction",
  "DailyBalance",
  "Loan",
  "LoanSchedule",
  "PushSubscription",
  "Event",
  "ClinicalSeries",
  "ClinicalAllergen",
  "ClinicalAllergenAlias",
  "ClinicalSkinTest",
  "ClinicalSkinTestResult",
  "ClinicalSeriesMergeLog",
  "ClinicalSkinTestImport",
  "ClinicalSkinTestWorkbookFile",
  "ClinicalSkinTestWorkbookSnapshot",
  "ClinicalDocumentImport",
  "AbandonmentContact",
  "InventoryCategory",
  "InventoryItem",
  "InventoryMovement",
  "DailyProductionBalance",
  "SupplyRequest",
  "CommonSupply",
  "SyncLog",
  "BackupLog",
  "CalendarSyncLog",
  "CalendarSyncLogEntry",
  "DoctoraliaSyncLog",
  "DoctoraliaSchedule",
  "DoctoraliaCalendarAppointment",
  "DoctoraliaWorkPeriod",
  "HaulmerSyncLog",
  "DoctoraliaEmailNotification",
  "DoctoraliaCookieStore",
  "WhatsappContact",
  "WhatsappChat",
  "WhatsappGroup",
  "WhatsappGroupParticipant",
  "WhatsappBlockedJid",
  "WhatsappBusinessQuickReply",
  "WhatsappBusinessLabel",
  "WhatsappBusinessChatLabel",
  "WhatsappBusinessMessageLabel",
  "WhatsappPresenceState",
  "WhatsappConversationState",
  "WhatsappMessage",
  "WhatsappMessageReaction",
  "WhatsappMessageReceipt",
  "WhatsappNotification",
  "BaileysAuthCreds",
  "BaileysAuthKeys",
  "PatientCampaign",
  "PatientCampaignRecipient",
];

function pickDelegate(db: Record<string, unknown>, modelName: string) {
  const camel = modelName.charAt(0).toLowerCase() + modelName.slice(1);
  for (const c of [camel, modelName]) {
    const d = db[c];
    if (d && typeof d === "object" && typeof (d as { count?: unknown }).count === "function") {
      return d as {
        count: (args?: unknown) => Promise<number>;
        createMany: (args: { data: unknown[]; skipDuplicates?: boolean }) => Promise<{ count: number }>;
        deleteMany: (args?: { where?: unknown }) => Promise<{ count: number }>;
      };
    }
  }
  return null;
}

function objectToUint8Array(value: unknown) {
  if (!value || typeof value !== "object" || value instanceof Uint8Array) return value;
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) return value;
  if (!entries.every(([key, byte]) => /^\d+$/.test(key) && typeof byte === "number")) return value;
  return Uint8Array.from(
    entries
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([, byte]) => byte as number),
  );
}

function numericStringToBigInt(value: unknown) {
  if (typeof value !== "string" || !/^-?\d+$/.test(value)) return value;
  return BigInt(value);
}

function isoDateToTime(value: unknown) {
  if (typeof value !== "string") return value;
  const match = /^\d{4}-\d{2}-\d{2}T(\d{2}:\d{2}:\d{2})(\.\d{3})?Z$/.exec(value);
  if (!match) return value;
  return `${match[1]}${match[2] ?? ""}`;
}

function normalizeRow(modelName: string, row: unknown) {
  if (!row || typeof row !== "object" || Array.isArray(row)) return row;
  const copy = { ...(row as Record<string, unknown>) };

  if (modelName === "RolePermission" && copy.conditions === null) {
    delete copy.conditions;
  }

  if (modelName === "Employee" && copy.metadata === null) {
    delete copy.metadata;
  }

  if (modelName === "EmployeeTimesheet" || modelName === "AttendanceMark") {
    copy.id = numericStringToBigInt(copy.id);
  }

  if (modelName === "EmployeeTimesheet") {
    copy.startTime = isoDateToTime(copy.startTime);
    copy.endTime = isoDateToTime(copy.endTime);
  }

  if (modelName === "Passkey") {
    copy.publicKey = objectToUint8Array(copy.publicKey);
    if (typeof copy.counter === "string") copy.counter = BigInt(copy.counter);
  }

  return copy;
}

function normalizeEmployeeTimesheetForInsert(row: unknown) {
  const copy = normalizeRow("EmployeeTimesheet", row) as Record<string, unknown>;
  return {
    id: copy.id,
    employee_id: copy.employeeId,
    work_date: copy.workDate,
    start_time: copy.startTime,
    end_time: copy.endTime,
    worked_minutes: copy.workedMinutes,
    overtime_minutes: copy.overtimeMinutes,
    comment: copy.comment,
  };
}

async function createManyOverride(
  modelName: string,
  rows: unknown[],
  dbModule: Record<string, unknown> | null,
) {
  if (modelName !== "EmployeeTimesheet" || !dbModule) return null;
  const kysely = dbModule.kysely as {
    insertInto: (table: string) => {
      values: (values: unknown[]) => {
        onConflict: (callback: (oc: { columns: (columns: string[]) => { doNothing: () => unknown } }) => unknown) => {
          returning: (column: string) => { execute: () => Promise<unknown[]> };
        };
      };
    };
  };
  const inserted = await kysely
    .insertInto("employee_timesheets")
    .values(rows.map(normalizeEmployeeTimesheetForInsert))
    .onConflict((oc) => oc.columns(["employee_id", "work_date"]).doNothing())
    .returning("id")
    .execute();
  return { count: inserted.length };
}

class Progress {
  start = Date.now();
  bytesRead = 0;
  totalBytes: number;
  currentModel = "";
  rowsTotal = 0;
  rowsForModel = 0;
  modelsDone = 0;
  modelsTotal = 0;
  lastTick = 0;

  constructor(totalBytes: number, modelsTotal: number) {
    this.totalBytes = totalBytes;
    this.modelsTotal = modelsTotal;
  }
  addBytes(n: number) {
    this.bytesRead += n;
  }
  addRow() {
    this.rowsTotal += 1;
    this.rowsForModel += 1;
  }
  setModel(name: string) {
    this.currentModel = name;
    this.rowsForModel = 0;
  }
  doneModel() {
    this.modelsDone += 1;
    this.bytesRead = 0; // each model resets bytes (separate stream)
    this.start = Date.now();
  }
  tick(force = false) {
    const now = Date.now();
    if (!force && now - this.lastTick < 1500) return;
    this.lastTick = now;
    const elapsed = now - this.start;
    const speed = elapsed > 0 ? this.bytesRead / (elapsed / 1000) : 0;
    const pct =
      this.totalBytes > 0 ? Math.min(99, Math.round((this.bytesRead / this.totalBytes) * 100)) : 0;
    const eta =
      speed > 0 && this.totalBytes > this.bytesRead
        ? fmtTime(((this.totalBytes - this.bytesRead) / speed) * 1000)
        : "?";
    const model = this.currentModel;
    const pad = (s: string, n: number) => (s.length >= n ? s.slice(0, n) : s + " ".repeat(n - s.length));
    process.stdout.write(
      `\r[${this.modelsDone + 1}/${this.modelsTotal}] ${pad(model, 36)} rows=${this.rowsForModel.toString().padStart(7)} | total=${this.rowsTotal.toString().padStart(8)} | ${pct.toString().padStart(2)}% ${fmtBytes(this.bytesRead)}/${fmtBytes(this.totalBytes)} ${(speed / 1024 / 1024).toFixed(1)}MB/s ETA ${eta}     `,
    );
  }
}

class SinglePassProgress {
  start = Date.now();
  bytesRead = 0;
  lastTick = 0;

  constructor(
    readonly totalBytes: number,
    readonly label: string,
  ) {}

  addBytes(n: number) {
    this.bytesRead += n;
  }

  tick(rowsTotal: number, force = false) {
    const now = Date.now();
    if (!force && now - this.lastTick < 1500) return;
    this.lastTick = now;
    const elapsed = now - this.start;
    const speed = elapsed > 0 ? this.bytesRead / (elapsed / 1000) : 0;
    const pct =
      this.totalBytes > 0 ? Math.min(99, Math.round((this.bytesRead / this.totalBytes) * 100)) : 0;
    const eta =
      speed > 0 && this.totalBytes > this.bytesRead
        ? fmtTime(((this.totalBytes - this.bytesRead) / speed) * 1000)
        : "?";
    process.stdout.write(
      `\r${this.label} rows=${rowsTotal.toString().padStart(8)} | ${pct.toString().padStart(2)}% ${fmtBytes(this.bytesRead)}/${fmtBytes(this.totalBytes)} ${(speed / 1024 / 1024).toFixed(1)}MB/s ETA ${eta}     `,
    );
  }
}

async function countRowsSinglePass(path: string, models: string[], fileBytes: number) {
  const wanted = new Set(models);
  const counts = new Map(models.map((m) => [m, 0]));
  const keys = new Map(models.map((m) => [m, new Set<string>()]));
  const progress = new SinglePassProgress(fileBytes, "[dry single-pass]");
  const isGz = path.toLowerCase().endsWith(".gz");
  const base = createReadStream(path);
  let totalRows = 0;
  base.on("data", (c: Buffer) => {
    progress.addBytes(c.length);
    progress.tick(totalRows);
  });
  const upstream = isGz ? base.pipe(createGunzip()) : base;
  const tokens = upstream.pipe(parser.asStream());

  let pendingKey: string | undefined;
  const stack: Array<{
    type: "object" | "array";
    key?: string;
    isData?: boolean;
    modelName?: string;
    isRow?: boolean;
  }> = [];

  progress.tick(totalRows, true);
  for await (const token of tokens as AsyncIterable<{ name: string; value?: unknown }>) {
    if (token.name === "keyValue") {
      const current = stack.at(-1);
      if (current?.isRow && current.modelName && typeof token.value === "string") {
        keys.get(current.modelName)?.add(token.value);
      }
      pendingKey = typeof token.value === "string" ? token.value : undefined;
      continue;
    }

    if (token.name === "startObject") {
      const parent = stack.at(-1);
      const modelName = parent?.type === "array" ? parent.modelName : undefined;
      if (parent?.type === "array" && parent.modelName) {
        counts.set(parent.modelName, (counts.get(parent.modelName) ?? 0) + 1);
        totalRows += 1;
      }
      stack.push({
        type: "object",
        key: pendingKey,
        isData: pendingKey === "data",
        modelName,
        isRow: Boolean(modelName),
      });
      pendingKey = undefined;
      continue;
    }

    if (token.name === "startArray") {
      const parent = stack.at(-1);
      const modelName = parent?.isData && pendingKey && wanted.has(pendingKey) ? pendingKey : undefined;
      stack.push({ type: "array", key: pendingKey, modelName });
      pendingKey = undefined;
      continue;
    }

    if (token.name === "endObject" || token.name === "endArray") {
      stack.pop();
    }
  }

  progress.tick(totalRows, true);
  process.stdout.write("\n");
  return { counts, keys, totalRows };
}

async function runPreflight(db: Record<string, unknown>, models: string[]) {
  const missingDelegates: string[] = [];
  const existingRows: Array<{ model: string; count: number }> = [];
  for (const modelName of models) {
    const delegate = pickDelegate(db, modelName);
    if (!delegate) {
      missingDelegates.push(modelName);
      continue;
    }
    const count = await delegate.count();
    if (count > 0) existingRows.push({ model: modelName, count });
  }
  return { missingDelegates, existingRows };
}

async function truncateExistingModels(db: Record<string, unknown>, models: string[]) {
  console.log("🧹 Truncando modelos existentes en orden inverso...");
  const truncated: Array<{ model: string; count: number }> = [];
  const errors: Array<{ model: string; error: string }> = [];
  for (const modelName of [...models].reverse()) {
    const delegate = pickDelegate(db, modelName);
    if (!delegate) continue;
    try {
      const existing = await delegate.count();
      if (existing === 0) continue;
      await delegate.deleteMany({});
      truncated.push({ model: modelName, count: existing });
      process.stdout.write(`   🧹 ${modelName}: ${existing.toLocaleString("es-CL")} rows\n`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push({ model: modelName, error: msg });
      process.stdout.write(`   ⚠️  ${modelName}: ${msg.slice(0, 200)}\n`);
    }
  }
  if (errors.length > 0) {
    throw new Error(`No se pudo truncar ${errors.length} modelos; primer error ${errors[0]?.model}: ${errors[0]?.error}`);
  }
  console.log(`   Modelos truncados: ${truncated.length}`);
  console.log("");
}

async function schemaScalarFields() {
  const { schema } = await import("@finanzas/db");
  const models = (schema as { models: Record<string, { fields: Record<string, { relation?: unknown }> }> }).models;
  return new Map(
    Object.entries(models).map(([modelName, model]) => [
      modelName,
      new Set(
        Object.entries(model.fields)
          .filter(([, field]) => !field.relation)
          .map(([fieldName]) => fieldName),
      ),
    ]),
  );
}

async function compareBackupKeysToSchema(backupKeys: Map<string, Set<string>>, models: string[]) {
  const fieldsByModel = await schemaScalarFields();
  const mismatches: Array<{ model: string; extra: string[] }> = [];
  for (const modelName of models) {
    const schemaFields = fieldsByModel.get(modelName);
    if (!schemaFields) {
      mismatches.push({ model: modelName, extra: ["NO-SCHEMA-MODEL"] });
      continue;
    }
    const extra = [...(backupKeys.get(modelName) ?? [])].filter((key) => !schemaFields.has(key)).sort();
    if (extra.length > 0) mismatches.push({ model: modelName, extra });
  }
  return mismatches;
}

async function main() {
  const { path, tablesFilter, truncate, dry, preflight } = parseArgs();
  if (!existsSync(path)) {
    console.error(`No existe: ${path}`);
    process.exit(1);
  }
  const fileBytes = statSync(path).size;
  console.log(`📦 ${path}`);
  console.log(`   tamaño archivo: ${fmtBytes(fileBytes)}`);

  console.log(`🔎 Leyendo header...`);
  const headerTables = await readHeaderTables(path);
  console.log(`   ${headerTables.length} tablas en header`);

  const ordered = [
    ...ORDER_HINT.filter((m) => headerTables.includes(m)),
    ...headerTables.filter((m) => !ORDER_HINT.includes(m)).sort(),
  ];
  const models = tablesFilter?.length
    ? tablesFilter.filter((m) => headerTables.includes(m))
    : ordered;
  console.log(`📋 A procesar: ${models.length} modelos${tablesFilter ? ` (filtrado)` : ""}`);
  console.log("");

  const progressStart = Date.now();

  if (preflight) {
    console.log("🧪 Preflight DB...");
    const db = (await import("@finanzas/db")).db as Record<string, unknown>;
    const result = await runPreflight(db, models);
    console.log(`   Delegates faltantes: ${result.missingDelegates.length}`);
    if (result.missingDelegates.length) console.log(`     ${result.missingDelegates.slice(0, 30).join(", ")}`);
    console.log(`   Modelos con filas existentes: ${result.existingRows.length}`);
    if (result.existingRows.length) {
      console.log(
        `     ${result.existingRows
          .slice(0, 30)
          .map((r) => `${r.model}=${r.count}`)
          .join(", ")}`,
      );
    }
    console.log("");
  }

  if (dry) {
    const { counts, keys, totalRows } = await countRowsSinglePass(path, models, fileBytes);
    const schemaMismatches = preflight ? await compareBackupKeysToSchema(keys, models) : [];
    console.log("");
    console.log("📊 Resumen:");
    console.log(`   Modelos procesados: ${models.length}`);
    console.log(`   Total rows leídas: ${totalRows.toLocaleString("es-CL")}`);
    for (const modelName of models) {
      console.log(`   🔢 ${modelName}: ${(counts.get(modelName) ?? 0).toLocaleString("es-CL")} rows`);
    }
    if (preflight) {
      console.log(`   Schema mismatches: ${schemaMismatches.length}`);
      for (const mismatch of schemaMismatches.slice(0, 30)) {
        console.log(`     ${mismatch.model}: ${mismatch.extra.slice(0, 20).join(", ")}`);
      }
    }
    console.log(`   Tiempo total: ${fmtTime(Date.now() - progressStart)}`);
    return;
  }

  const progress = new Progress(fileBytes, models.length);
  const CHUNK = 500;

  const dbModule = dry ? null : ((await import("@finanzas/db")) as Record<string, unknown>);
  const db = dbModule?.db as Record<string, unknown>;
  if (truncate) {
    await truncateExistingModels(db, models);
  }
  let totalInserted = 0;
  const skipped: string[] = [];
  const errors: Array<{ model: string; error: string }> = [];

  for (const modelName of models) {
    progress.setModel(modelName);
    progress.tick(true);

    const delegate = dry ? null : pickDelegate(db, modelName);
    if (!dry && !delegate) {
      skipped.push(`${modelName}=NO-DELEGATE`);
      progress.doneModel();
      continue;
    }
    if (!dry && delegate) {
      const existing = await delegate.count();
      if (existing > 0 && !truncate) {
        skipped.push(`${modelName}=skip(${existing} existing)`);
        progress.doneModel();
        process.stdout.write(`\n   ⏭️  ${modelName}: skip (${existing} rows ya existen)\n`);
        continue;
      }
    }

    let inserted = 0;
    let chunkErrors = 0;
    try {
      for await (const chunk of streamModelRowsWithProgress(path, modelName, CHUNK, (n) => {
        progress.addBytes(n);
        progress.tick();
      })) {
        for (let i = 0; i < chunk.length; i++) progress.addRow();
        if (dry) continue;
        try {
          const data = chunk.map((row) => normalizeRow(modelName, row));
          const r =
            (await createManyOverride(modelName, chunk, dbModule)) ??
            (await delegate!.createMany({ data, skipDuplicates: true }));
          inserted += r.count;
        } catch (err) {
          chunkErrors += 1;
          if (chunkErrors <= 2) {
            const msg = err instanceof Error ? err.message : String(err);
            process.stdout.write(`\n   ⚠️  ${modelName} chunk: ${msg.slice(0, 200)}\n`);
          }
        }
      }
      totalInserted += inserted;
      const sym = dry ? "🔢" : inserted > 0 ? "✅" : "⚪";
      process.stdout.write(
        `\n   ${sym} ${modelName}: ${dry ? `${progress.rowsForModel} rows` : `+${inserted}/${progress.rowsForModel}`}${chunkErrors ? ` (${chunkErrors} chunk errors)` : ""}\n`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push({ model: modelName, error: msg });
      process.stdout.write(`\n   ❌ ${modelName}: ${msg.slice(0, 200)}\n`);
    }

    progress.doneModel();
  }

  process.stdout.write("\n\n");
  console.log("📊 Resumen:");
  console.log(`   Modelos procesados: ${models.length}`);
  console.log(`   Total rows leídas: ${progress.rowsTotal.toLocaleString("es-CL")}`);
  if (!dry) console.log(`   Insertadas: ${totalInserted.toLocaleString("es-CL")}`);
  console.log(`   Skipped: ${skipped.length}`);
  if (skipped.length) console.log(`     ${skipped.slice(0, 30).join(", ")}`);
  if (errors.length) {
    console.log(`   Errores fatales: ${errors.length}`);
    for (const e of errors) console.log(`     ${e.model}: ${e.error.slice(0, 200)}`);
  }
  console.log(`   Tiempo total: ${fmtTime(Date.now() - progress.start)}`);
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("\nFATAL:", err);
    process.exit(1);
  });
