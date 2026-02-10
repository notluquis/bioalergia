/**
 * CSV Upload Routes for Hono API
 *
 * Handles bulk data import via CSV with preview and validation
 */

import { db } from "@finanzas/db";
import dayjs from "dayjs";
import { Decimal } from "decimal.js";
import { Hono } from "hono";
import { hasPermission } from "../auth";
import { importDtePurchaseRow, importDteSaleRow } from "../lib/dte-import";
import { verifyToken } from "../lib/paseto";
import { normalizeTimesheetPayload, upsertTimesheetEntry } from "../services/timesheets";
import { reply } from "../utils/reply";

const COOKIE_NAME = "finanzas_session";
const CURRENCY_DOLLAR_REGEX = /\$/g;
const THOUSANDS_DOT_REGEX = /\./g;
const DECIMAL_COMMA_REGEX = /,/g;
const SLASH_DATE_REGEX = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
const HYPHEN_DATE_REGEX = /^(\d{1,2})-(\d{1,2})-(\d{4})$/;
const TIME_REGEX = /^\d{1,2}:\d{2}$/;

export const csvUploadRoutes = new Hono();

// Table schemas for validation (simplified - use Zod in production)
type TableName =
  | "people"
  | "employees"
  | "counterparts"
  | "daily_balances"
  | "daily_production_balances"
  | "transactions"
  | "withdrawals"
  | "services"
  | "inventory_items"
  | "employee_timesheets"
  | "dte_purchases"
  | "dte_sales";

type AuthContext = {
  email: string;
  userId: number;
};

interface CSVRow {
  // Generic fields
  rut?: unknown;
  names?: unknown;
  fatherName?: unknown;
  motherName?: unknown;
  email?: unknown;
  phone?: unknown;
  address?: unknown;
  position?: unknown;
  startDate?: unknown;
  type?: unknown;
  frequency?: unknown;
  amount?: unknown;
  closingBalance?: unknown;
  note?: unknown;
  date?: unknown;
  balanceDate?: unknown;
  Fecha?: unknown;
  ingresoTarjetas?: unknown;
  ingresoTransferencias?: unknown;
  ingresoEfectivo?: unknown;
  gastosDiarios?: unknown;
  otrosAbonos?: unknown;
  consultasMonto?: unknown;
  controlesMonto?: unknown;
  testsMonto?: unknown;
  vacunasMonto?: unknown;
  licenciasMonto?: unknown;
  roxairMonto?: unknown;
  comentarios?: unknown;
  Comentarios?: unknown;
  status?: unknown;
  changeReason?: unknown;
  name?: unknown;
  defaultAmount?: unknown;
  description?: unknown;
  currentStock?: unknown;
  categoryId?: unknown;
  workDate?: unknown;
  startTime?: unknown;
  endTime?: unknown;
  workedMinutes?: unknown;
  overtimeMinutes?: unknown;
  comment?: unknown;
  "INGRESO TARJETAS"?: unknown;
  "INGRESO TRANSFERENCIAS"?: unknown;
  "INGRESO EFECTIVO"?: unknown;
  "GASTOS DIARIOS"?: unknown;
  "Otros/abonos"?: unknown;
  CONSULTAS?: unknown;
  CONTROLES?: unknown;
  TEST?: unknown;
  VACUNAS?: unknown;
  LICENCIAS?: unknown;
  ROXAIR?: unknown;
  dateCreated?: unknown;
  withdrawId?: unknown;
  statusDetail?: unknown;
  fee?: unknown;
  activityUrl?: unknown;
  payoutDescription?: unknown;
  bankAccountHolder?: unknown;
  identificationType?: unknown;
  identificationNumber?: unknown;
  bankId?: unknown;
  bankName?: unknown;
  bankBranch?: unknown;
  bankAccountType?: unknown;
  bankAccountNumber?: unknown;
  // DTE fields (common)
  period?: unknown;
  registerNumber?: unknown;
  documentType?: unknown;
  documentDate?: unknown;
  receiptDate?: unknown;
  exemptAmount?: unknown;
  netAmount?: unknown;
  totalAmount?: unknown;
  notes?: unknown;
  // DTE Purchase fields
  purchaseType?: unknown;
  providerRUT?: unknown;
  providerName?: unknown;
  folio?: unknown;
  acknowledgeDate?: unknown;
  recoverableIVA?: unknown;
  nonRecoverableIVA?: unknown;
  nonRecoverableIVACode?: unknown;
  fixedAssetNetAmount?: unknown;
  commonUseIVA?: unknown;
  nonCreditableTax?: unknown;
  nonRetainedIVA?: unknown;
  referenceDocNote?: unknown;
  // DTE Sale fields
  saleType?: unknown;
  clientRUT?: unknown;
  clientName?: unknown;
  ivaAmount?: unknown;
  receiptAcknowledgeDate?: unknown;
  claimDate?: unknown;
  referenceDocType?: unknown;
  referenceDocFolio?: unknown;
  foreignBuyerIdentifier?: unknown;
  foreignBuyerNationality?: unknown;
  internalNumber?: unknown;
  branchCode?: unknown;
  purchaseId?: unknown;
  shippingOrderId?: unknown;
  origin?: unknown;
  informativeNote?: unknown;
  paymentNote?: unknown;
  totalRetainedIVA?: unknown;
  partialRetainedIVA?: unknown;
  ownIVA?: unknown;
  thirdPartyIVA?: unknown;
  lateIVA?: unknown;
  emitterRUT?: unknown;
  commissionNetAmount?: unknown;
  commissionExemptAmount?: unknown;
  commissionIVA?: unknown;
  constructorCreditAmount?: unknown;
  freeTradeZoneAmount?: unknown;
  containerGuaranteeAmount?: unknown;
  nonBillableAmount?: unknown;
  nationalTransportPassageAmount?: unknown;
  internationalTransportAmount?: unknown;
  // Tobacco fields
  pureTobacco?: unknown;
  cigaretteTobacco?: unknown;
  elaboratedTobacco?: unknown;
}

// ============================================================
// Zenstack v3 Helper Functions - Only include actual CSV fields
// ============================================================

// Helper to get auth
async function getAuth(c: { req: { header: (name: string) => string | undefined } }) {
  const cookieHeader = c.req.header("Cookie");
  if (!cookieHeader) {
    return null;
  }
  const cookies = Object.fromEntries(cookieHeader.split(";").map((c) => c.trim().split("=")));
  const token = cookies[COOKIE_NAME];
  if (!token) {
    return null;
  }
  try {
    const decoded = await verifyToken(token);
    return { userId: Number(decoded.sub), email: String(decoded.email) };
  } catch {
    return null;
  }
}

// Find person by RUT
async function findPersonByRut(rut: string) {
  return db.person.findFirst({
    where: { rut },
    include: { employee: true },
  });
}

// Clean amount string (removes $, commas, dots for thousands)
function cleanAmount(value: unknown): number {
  if (value == null || value === "") {
    return 0;
  }
  const str = String(value)
    .trim()
    .replace(CURRENCY_DOLLAR_REGEX, "") // Remove $
    .replace(THOUSANDS_DOT_REGEX, "") // Remove dots (thousands separator in CLP)
    .replace(DECIMAL_COMMA_REGEX, "."); // Replace comma with dot (decimal separator)
  const num = Number(str);
  return Number.isNaN(num) ? 0 : num;
}

// Parse date from DD/M/YYYY or DD/MM/YYYY format
function parseFlexibleDate(value: unknown): string | null {
  if (!value) {
    return null;
  }
  const str = String(value).trim();

  // Try DD/M/YYYY or DD/MM/YYYY format
  const match = str.match(SLASH_DATE_REGEX);
  if (match) {
    const [, day, month, year] = match;
    const paddedDay = day.padStart(2, "0");
    const paddedMonth = month.padStart(2, "0");
    return `${year}-${paddedMonth}-${paddedDay}`;
  }

  // Fallback to dayjs parsing
  const parsed = dayjs(str);
  return parsed.isValid() ? parsed.format("YYYY-MM-DD") : null;
}

// Permission mapping
const TABLE_PERMISSIONS: Record<TableName, { action: string; subject: string }> = {
  people: { action: "create", subject: "Person" },
  employees: { action: "create", subject: "Employee" },
  counterparts: { action: "create", subject: "Counterpart" },
  daily_balances: { action: "create", subject: "DailyBalance" },
  daily_production_balances: { action: "create", subject: "ProductionBalance" },
  transactions: { action: "create", subject: "Transaction" },
  withdrawals: { action: "create", subject: "WithdrawTransaction" },
  services: { action: "create", subject: "Service" },
  inventory_items: { action: "create", subject: "InventoryItem" },
  employee_timesheets: { action: "create", subject: "Timesheet" },
  dte_purchases: { action: "create", subject: "DTEPurchaseDetail" },
  dte_sales: { action: "create", subject: "DTESaleDetail" },
};

// ============================================================
// PREVIEW (VALIDATE WITHOUT INSERTING)
// ============================================================

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: legacy csv preview
csvUploadRoutes.post("/preview", async (c) => {
  const auth = await getAuth(c);
  if (!auth) {
    return reply(c, { status: "error", message: "No autorizado" }, 401);
  }

  const { table, data, mode } = await c.req.json<{
    table: TableName;
    data: object[];
    mode?: "insert-only" | "insert-or-update";
  }>();

  if (!table || !data || !Array.isArray(data)) {
    return reply(c, { status: "error", message: "Table and data array required" }, 400);
  }

  // Check permissions
  const required = TABLE_PERMISSIONS[table];
  if (required) {
    const hasPerm = await hasPermission(auth.userId, required.action, required.subject);
    if (!hasPerm) {
      return reply(c, { status: "error", message: "Forbidden" }, 403);
    }
  }

  console.log(
    `[CSV Preview] Table: ${table}, Rows: ${data.length}, Mode: ${mode ?? "insert-or-update"}`,
  );

  const errors: string[] = [];
  let toInsert = 0;
  let toUpdate = 0;
  let toSkip = 0;

  for (let i = 0; i < data.length; i++) {
    const row = data[i] as CSVRow;

    try {
      if (table === "people" && row.rut) {
        const exists = await findPersonByRut(String(row.rut));
        if (exists) {
          if (mode === "insert-only") {
            toSkip++;
          } else {
            toUpdate++;
          }
        } else {
          toInsert++;
        }
      } else if ((table === "employees" || table === "counterparts") && row.rut) {
        const person = await findPersonByRut(String(row.rut));
        if (!person) {
          errors.push(`Fila ${i + 1}: Persona con RUT ${row.rut} no existe`);
          toSkip++;
        } else {
          if (table === "employees") {
            const existingEmployee = await db.employee.findFirst({
              where: { personId: person.id },
            });
            if (existingEmployee) {
              if (mode === "insert-only") {
                toSkip++;
              } else {
                toUpdate++;
              }
            } else {
              toInsert++;
            }
          } else if (table === "counterparts") {
            const identNumber = String(row.rut).replace(/[^0-9k]/gi, "");
            const existingCounterpart = await db.counterpart.findFirst({
              where: { identificationNumber: identNumber },
            } as never);
            if (existingCounterpart) {
              if (mode === "insert-only") {
                toSkip++;
              } else {
                toUpdate++;
              }
            } else {
              toInsert++;
            }
          }
        }
      } else if (table === "daily_balances" && row.date) {
        const dateStr = dayjs(String(row.date)).format("YYYY-MM-DD");
        const exists = await db.dailyBalance.findUnique({
          where: { date: new Date(dateStr) },
        });
        if (exists) {
          if (mode === "insert-only") {
            toSkip++;
          } else {
            toUpdate++;
          }
        } else {
          toInsert++;
        }
      } else if (table === "daily_production_balances") {
        const dateStr = parseFlexibleDate(row.balanceDate || row.Fecha);
        if (!dateStr) {
          errors.push(`Fila ${i + 1}: Fecha inválida`);
          toSkip++;
          continue;
        }
        const exists = await db.dailyProductionBalance.findUnique({
          where: { balanceDate: new Date(dateStr) },
        });
        if (exists) {
          if (mode === "insert-only") {
            toSkip++;
          } else {
            toUpdate++;
          }
        } else {
          toInsert++;
        }
      } else if (table === "withdrawals") {
        if (!row.withdrawId) {
          errors.push(`Fila ${i + 1}: withdrawId requerido`);
          toSkip++;
          continue;
        }
        const exists = await db.withdrawTransaction.findUnique({
          where: { withdrawId: String(row.withdrawId) },
        });
        if (exists) {
          if (mode === "insert-only") {
            toSkip++;
          } else {
            toUpdate++;
          }
        } else {
          toInsert++;
        }
      } else if (table === "services" && row.name) {
        // Services can have duplicate names, so just count as insert
        toInsert++;
      } else if (table === "inventory_items" && row.name) {
        const exists = await db.inventoryItem.findFirst({
          where: { name: String(row.name) },
        });
        if (exists) {
          if (mode === "insert-only") {
            toSkip++;
          } else {
            toUpdate++;
          }
        } else {
          toInsert++;
        }
      } else if (table === "employee_timesheets" && row.rut && row.workDate) {
        const person = await findPersonByRut(String(row.rut));
        if (!person) {
          errors.push(`Fila ${i + 1}: Empleado con RUT ${row.rut} no existe`);
          toSkip++;
        } else {
          // Validate date format is DD-MM-YYYY (e.g., "08-08-2025" = August 8, 2025)
          const workDateStr = String(row.workDate).trim();
          const dateMatch = workDateStr.match(HYPHEN_DATE_REGEX);
          if (!dateMatch) {
            errors.push(
              `Fila ${i + 1}: Fecha "${workDateStr}" en formato inválido. Use DD-MM-YYYY (ej: 08-08-2025)`,
            );
            toSkip++;
            continue;
          }

          const [, dayStr, monthStr, yearStr] = dateMatch;
          const day = Number.parseInt(dayStr, 10);
          const month = Number.parseInt(monthStr, 10);

          if (month < 1 || month > 12) {
            errors.push(
              `Fila ${i + 1}: Mes inválido en "${workDateStr}". Use DD-MM-YYYY (mes 01-12)`,
            );
            toSkip++;
            continue;
          }
          if (day < 1 || day > 31) {
            errors.push(
              `Fila ${i + 1}: Día inválido en "${workDateStr}". Use DD-MM-YYYY (día 01-31)`,
            );
            toSkip++;
            continue;
          }

          // Validate date actually exists
          const isoDate = `${yearStr}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const testDate = new Date(`${isoDate}T00:00:00Z`);
          if (Number.isNaN(testDate.getTime())) {
            errors.push(`Fila ${i + 1}: Fecha inválida "${workDateStr}"`);
            toSkip++;
            continue;
          }

          const exists = await db.employeeTimesheet.findFirst({
            where: {
              employee: {
                person: { id: person.id },
              },
              workDate: testDate,
            },
          });
          if (exists) {
            if (mode === "insert-only") {
              toSkip++;
            } else {
              toUpdate++;
            }
          } else {
            toInsert++;
          }
        }
      } else if (table === "dte_purchases" && row.providerRUT && row.folio) {
        // DTE Purchases are identified by providerRUT + folio + documentDate
        const dateStr = parseFlexibleDate(row.documentDate);
        if (!dateStr) {
          errors.push(`Fila ${i + 1}: Fecha de documento inválida`);
          toSkip++;
          continue;
        }
        const exists = await db.dTEPurchaseDetail.findFirst({
          where: {
            providerRUT: String(row.providerRUT),
            folio: String(row.folio),
            documentDate: new Date(dateStr),
          },
        });
        if (exists) {
          if (mode === "insert-only") {
            toSkip++;
          } else {
            toUpdate++;
          }
        } else {
          toInsert++;
        }
      } else if (table === "dte_sales" && row.clientRUT && row.folio) {
        // DTE Sales are identified by clientRUT + folio + documentDate
        const dateStr = parseFlexibleDate(row.documentDate);
        if (!dateStr) {
          errors.push(`Fila ${i + 1}: Fecha de documento inválida`);
          toSkip++;
          continue;
        }
        const exists = await db.dTESaleDetail.findFirst({
          where: {
            clientRUT: String(row.clientRUT),
            folio: String(row.folio),
            documentDate: new Date(dateStr),
          },
        });
        if (exists) {
          if (mode === "insert-only") {
            toSkip++;
          } else {
            toUpdate++;
          }
        } else {
          toInsert++;
        }
      } else {
        toInsert++;
      }
    } catch (_e) {
      errors.push(`Fila ${i + 1}: Error de validación`);
      toSkip++;
    }
  }

  return reply(c, {
    status: "ok",
    toInsert,
    toUpdate,
    toSkip,
    errors: errors.slice(0, 20), // Limit errors
  });
});

// ============================================================
// IMPORT (INSERT/UPDATE DATA)
// ============================================================

csvUploadRoutes.post("/import", async (c) => {
  const auth = await getAuth(c);
  if (!auth) {
    return reply(c, { status: "error", message: "No autorizado" }, 401);
  }

  const { table, data, mode } = await c.req.json<{
    table: TableName;
    data: object[];
    mode?: "insert-only" | "insert-or-update";
  }>();

  if (!table || !data || !Array.isArray(data)) {
    return reply(c, { status: "error", message: "Table and data array required" }, 400);
  }

  // Check permissions
  const required = TABLE_PERMISSIONS[table];
  if (required) {
    const hasPerm = await hasPermission(auth.userId, required.action, required.subject);
    if (!hasPerm) {
      return reply(c, { status: "error", message: "Forbidden" }, 403);
    }
  }

  const { inserted, updated, skipped, errors } = await importCsvRows(
    table,
    data,
    auth,
    mode ?? "insert-or-update",
  );

  console.log(
    "[CSV] Import by",
    auth.email,
    ":",
    table,
    `(${mode ?? "insert-or-update"})`,
    "- inserted:",
    inserted,
    "updated:",
    updated,
    "skipped:",
    skipped,
  );
  return reply(c, {
    status: "ok",
    inserted,
    updated,
    skipped,
    toInsert: inserted,
    toUpdate: updated,
    toSkip: skipped,
    errors: errors.slice(0, 20),
  });
});

type ImportOutcome = { inserted: number; skipped: number; updated: number };
type ImportResult = ImportOutcome & { errors: string[] };

const emptyOutcome = (): ImportOutcome => ({ inserted: 0, skipped: 0, updated: 0 });

const addOutcome = (totals: ImportOutcome, outcome: ImportOutcome) => {
  totals.inserted += outcome.inserted;
  totals.updated += outcome.updated;
  totals.skipped += outcome.skipped;
};

async function importCsvRows(
  table: TableName,
  data: object[],
  auth: AuthContext,
  mode: "insert-only" | "insert-or-update" = "insert-or-update",
): Promise<ImportResult> {
  const totals = emptyOutcome();
  const errors: string[] = [];

  for (let i = 0; i < data.length; i++) {
    const row = data[i] as CSVRow;
    try {
      const outcome = await importCsvRow(table, row, auth, mode);
      addOutcome(totals, outcome);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Error desconocido";
      errors.push(`Fila ${i + 1}: ${msg}`);
      totals.skipped += 1;
    }
  }

  return { ...totals, errors };
}

type ImportRowHandler = (
  row: CSVRow,
  auth: AuthContext,
  mode: "insert-only" | "insert-or-update",
) => Promise<ImportOutcome>;

const importRowHandlers: Record<TableName, ImportRowHandler> = {
  people: (row, _, mode) => importPeopleRow(row, mode),
  employees: (row, _, mode) => importEmployeesRow(row, mode),
  counterparts: (row, _, mode) => importCounterpartsRow(row, mode),
  daily_balances: (row, _, mode) => importDailyBalancesRow(row, mode),
  daily_production_balances: (row, auth, mode) =>
    importDailyProductionBalancesRow(row, auth.userId, mode),
  transactions: async () => ({ inserted: 0, updated: 0, skipped: 1 }),
  withdrawals: (row, _, mode) => importWithdrawalsRow(row, mode),
  services: (row) => importServicesRow(row),
  inventory_items: (row, _, mode) => importInventoryItemsRow(row, mode),
  employee_timesheets: (row, _, mode) => importEmployeeTimesheetsRow(row, mode),
  dte_purchases: (row, _, mode) => importDtePurchaseRow(row as Record<string, unknown>, mode),
  dte_sales: (row, _, mode) => importDteSaleRow(row as Record<string, unknown>, mode),
};

async function importCsvRow(
  table: TableName,
  row: CSVRow,
  auth: AuthContext,
  mode: "insert-only" | "insert-or-update",
): Promise<ImportOutcome> {
  const handler = importRowHandlers[table];
  return handler ? handler(row, auth, mode) : { inserted: 0, updated: 0, skipped: 1 };
}

async function importPeopleRow(
  row: CSVRow,
  mode: "insert-only" | "insert-or-update",
): Promise<ImportOutcome> {
  const existing = await findPersonByRut(String(row.rut));
  const personData = {
    names: String(row.names || ""),
    fatherName: row.fatherName ? String(row.fatherName) : null,
    motherName: row.motherName ? String(row.motherName) : null,
    email: row.email ? String(row.email) : null,
    phone: row.phone ? String(row.phone) : null,
    address: row.address ? String(row.address) : null,
  };

  if (existing) {
    if (mode === "insert-only") {
      return { inserted: 0, updated: 0, skipped: 1 };
    }
    await db.person.update({
      where: { id: existing.id },
      data: personData,
    });
    return { inserted: 0, updated: 1, skipped: 0 };
  }

  await db.person.create({
    data: { rut: String(row.rut), ...personData },
  });
  return { inserted: 1, updated: 0, skipped: 0 };
}

async function importEmployeesRow(
  row: CSVRow,
  mode: "insert-only" | "insert-or-update",
): Promise<ImportOutcome> {
  const person = await findPersonByRut(String(row.rut));
  if (!person) {
    throw new Error(`Persona con RUT ${row.rut} no existe`);
  }

  // Find existing employee by person relationship
  const existingEmployee = await db.employee.findFirst({
    where: { person: { id: person.id } },
  });

  const employeeData = {
    position: row.position ? String(row.position) : "No especificado",
    startDate: row.startDate
      ? new Date(dayjs(String(row.startDate)).format("YYYY-MM-DD"))
      : new Date(),
    status: "ACTIVE" as const,
  };

  if (existingEmployee) {
    if (mode === "insert-only") {
      return { inserted: 0, updated: 0, skipped: 1 };
    }
    await db.employee.update({
      where: { id: existingEmployee.id },
      data: employeeData,
    });
    return { inserted: 0, updated: 1, skipped: 0 };
  }

  await db.employee.create({
    data: { ...employeeData, person: { connect: { id: person.id } } },
  });
  return { inserted: 1, updated: 0, skipped: 0 };
}

async function importCounterpartsRow(
  row: CSVRow,
  mode: "insert-only" | "insert-or-update",
): Promise<ImportOutcome> {
  const person = await findPersonByRut(String(row.rut));
  if (!person) {
    throw new Error(`Persona con RUT ${row.rut} no existe`);
  }

  const counterpartData = {
    category: String(row.type || "SUPPLIER") as "SUPPLIER" | "CLIENT",
  };

  // Try to find existing counterpart by identification number
  // Note: identificationNumber is typically the RUT, matching the person
  const identNumber = String(row.rut).replace(/[^0-9k]/gi, "");
  const existingCounterpart = await db.counterpart.findFirst({
    where: { identificationNumber: identNumber },
  } as never);

  if (existingCounterpart) {
    if (mode === "insert-only") {
      return { inserted: 0, updated: 0, skipped: 1 };
    }
    await db.counterpart.update({
      where: { id: existingCounterpart.id },
      data: counterpartData,
    });
    return { inserted: 0, updated: 1, skipped: 0 };
  }

  // Create new counterpart with identification number
  const identificationNumber = String(row.rut).replace(/[^0-9k]/gi, "");
  await db.counterpart.create({
    data: {
      ...counterpartData,
      identificationNumber,
      bankAccountHolder: String(row.names || ""),
    } as never,
  });
  return { inserted: 1, updated: 0, skipped: 0 };
}

async function importDailyBalancesRow(
  row: CSVRow,
  mode: "insert-only" | "insert-or-update",
): Promise<ImportOutcome> {
  const dateStr = dayjs(String(row.date)).format("YYYY-MM-DD");
  const date = new Date(dateStr);
  const amountNum = Number(row.amount) || Number(row.closingBalance) || 0;
  const balanceData = {
    amount: new Decimal(amountNum.toFixed(2)),
    note: row.note ? String(row.note) : undefined,
  };

  const existing = await db.dailyBalance.findUnique({ where: { date } });
  if (existing) {
    if (mode === "insert-only") {
      return { inserted: 0, updated: 0, skipped: 1 };
    }
    await db.dailyBalance.update({ where: { date }, data: balanceData });
    return { inserted: 0, updated: 1, skipped: 0 };
  }

  await db.dailyBalance.create({ data: { date, ...balanceData } });
  return { inserted: 1, updated: 0, skipped: 0 };
}

async function importDailyProductionBalancesRow(
  row: CSVRow,
  userId: number,
  mode: "insert-only" | "insert-or-update",
): Promise<ImportOutcome> {
  const balanceDate = parseProductionBalanceDate(row);
  const productionData = buildProductionBalanceData(row);
  const existing = await db.dailyProductionBalance.findUnique({
    where: { balanceDate },
  });

  if (existing) {
    if (mode === "insert-only") {
      return { inserted: 0, updated: 0, skipped: 1 };
    }
    await db.dailyProductionBalance.update({
      where: { balanceDate },
      data: productionData,
    });
    return { inserted: 0, updated: 1, skipped: 0 };
  }

  await db.dailyProductionBalance.create({
    data: {
      balanceDate,
      ...productionData,
      createdBy: userId,
    },
  });
  return { inserted: 1, updated: 0, skipped: 0 };
}

function buildWithdrawData(row: CSVRow) {
  const dateStr = parseFlexibleDate(row.dateCreated);
  if (!dateStr) {
    throw new Error("Fecha inválida");
  }

  const parseDecimal = (value: unknown) => {
    if (value == null || String(value).trim() === "") {
      return null;
    }
    const num = cleanAmount(value);
    return new Decimal(num.toFixed(2));
  };

  const amountValue = parseDecimal(row.amount);
  const feeValue = parseDecimal(row.fee);

  return {
    dateCreated: new Date(dateStr),
    status: row.status ? String(row.status) : null,
    statusDetail: row.statusDetail ? String(row.statusDetail) : null,
    amount: amountValue,
    fee: feeValue,
    activityUrl: row.activityUrl ? String(row.activityUrl) : null,
    payoutDescription: row.payoutDescription ? String(row.payoutDescription) : null,
    bankAccountHolder: row.bankAccountHolder ? String(row.bankAccountHolder) : null,
    identificationType: row.identificationType ? String(row.identificationType) : null,
    identificationNumber: row.identificationNumber ? String(row.identificationNumber) : null,
    bankId: row.bankId ? String(row.bankId) : null,
    bankName: row.bankName ? String(row.bankName) : null,
    bankBranch: row.bankBranch ? String(row.bankBranch) : null,
    bankAccountType: row.bankAccountType ? String(row.bankAccountType) : null,
    bankAccountNumber: row.bankAccountNumber ? String(row.bankAccountNumber) : null,
  };
}

async function importWithdrawalsRow(
  row: CSVRow,
  mode: "insert-only" | "insert-or-update",
): Promise<ImportOutcome> {
  if (!row.withdrawId) {
    throw new Error("withdrawId requerido");
  }

  const withdrawData = buildWithdrawData(row);
  const withdrawId = String(row.withdrawId);
  const existing = await db.withdrawTransaction.findUnique({
    where: { withdrawId },
  });

  if (existing) {
    if (mode === "insert-only") {
      return { inserted: 0, updated: 0, skipped: 1 };
    }
    await db.withdrawTransaction.update({
      where: { withdrawId },
      data: withdrawData,
    });
    return { inserted: 0, updated: 1, skipped: 0 };
  }

  await db.withdrawTransaction.create({
    data: { withdrawId, ...withdrawData },
  });
  return { inserted: 1, updated: 0, skipped: 0 };
}

function parseProductionBalanceDate(row: CSVRow) {
  const dateStr = parseFlexibleDate(row.balanceDate || row.Fecha);
  if (!dateStr) {
    throw new Error("Fecha inválida");
  }
  return new Date(dateStr);
}

function buildProductionBalanceData(row: CSVRow) {
  const pick = (...keys: Array<keyof CSVRow>) => {
    for (const key of keys) {
      const value = row[key];
      if (value !== undefined && value !== null && value !== "") {
        return value;
      }
    }
    return undefined;
  };

  return {
    ingresoTarjetas: cleanAmount(pick("ingresoTarjetas", "INGRESO TARJETAS")),
    ingresoTransferencias: cleanAmount(pick("ingresoTransferencias", "INGRESO TRANSFERENCIAS")),
    ingresoEfectivo: cleanAmount(pick("ingresoEfectivo", "INGRESO EFECTIVO")),
    gastosDiarios: cleanAmount(pick("gastosDiarios", "GASTOS DIARIOS")),
    otrosAbonos: cleanAmount(pick("otrosAbonos", "Otros/abonos")),
    consultasMonto: cleanAmount(pick("consultasMonto", "CONSULTAS")),
    controlesMonto: cleanAmount(pick("controlesMonto", "CONTROLES")),
    testsMonto: cleanAmount(pick("testsMonto", "TEST")),
    vacunasMonto: cleanAmount(pick("vacunasMonto", "VACUNAS")),
    licenciasMonto: cleanAmount(pick("licenciasMonto", "LICENCIAS")),
    roxairMonto: cleanAmount(pick("roxairMonto", "ROXAIR")),
    comentarios: pick("comentarios", "Comentarios")
      ? String(pick("comentarios", "Comentarios"))
      : null,
    status: (row.status as "DRAFT" | "FINAL") || "DRAFT",
    changeReason: row.changeReason ? String(row.changeReason) : null,
  };
}

async function importServicesRow(row: CSVRow): Promise<ImportOutcome> {
  const serviceData = {
    name: String(row.name),
    serviceType: String(row.type || "BUSINESS") as "BUSINESS" | "PERSONAL",
    frequency: String(row.frequency || "MONTHLY") as "MONTHLY" | "ONCE" | "ANNUAL",
    defaultAmount: row.defaultAmount ? new Decimal(Number(row.defaultAmount)) : new Decimal(0),
    status: String(row.status || "ACTIVE") as "ACTIVE" | "INACTIVE" | "ARCHIVED",
  };

  // Services always insert as unique records (can have duplicate names with different counterparts)
  await db.service.create({ data: serviceData });
  return { inserted: 1, updated: 0, skipped: 0 };
}

async function importInventoryItemsRow(
  row: CSVRow,
  mode: "insert-only" | "insert-or-update",
): Promise<ImportOutcome> {
  const itemData = {
    name: String(row.name),
    description: row.description ? String(row.description) : null,
    currentStock: row.currentStock ? Number(row.currentStock) : 0,
    categoryId: row.categoryId ? Number(row.categoryId) : null,
  };

  const existing = await db.inventoryItem.findFirst({
    where: { name: itemData.name },
  });

  if (existing) {
    if (mode === "insert-only") {
      return { inserted: 0, updated: 0, skipped: 1 };
    }
    await db.inventoryItem.update({
      where: { id: existing.id },
      data: itemData,
    });
    return { inserted: 0, updated: 1, skipped: 0 };
  }

  await db.inventoryItem.create({ data: itemData });
  return { inserted: 1, updated: 0, skipped: 0 };
}

/**
 * Parse timesheet date from DD-MM-YYYY format to YYYY-MM-DD ISO format
 *
 * Format: DD-MM-YYYY where:
 * - DD = Day (01-31)
 * - MM = Month (01-12)
 * - YYYY = Year (4 digits)
 *
 * Examples:
 * - "08-08-2025" → "2025-08-08" (August 8, 2025)
 * - "31-12-2025" → "2025-12-31" (December 31, 2025)
 * - "1-1-2025" → "2025-01-01" (single digit day/month OK)
 *
 * @param dateStr - Date string to parse
 * @returns ISO format date string (YYYY-MM-DD)
 * @throws Error if format is invalid or date is invalid
 */
function parseWorkDate(dateStr: unknown): string {
  const dateMatch = String(dateStr).trim().match(HYPHEN_DATE_REGEX);
  if (!dateMatch) {
    throw new Error("Fecha en formato inválido. Use DD-MM-YYYY (ej: 08-08-2025 para 8 de agosto)");
  }

  const [, dayStr, monthStr, year] = dateMatch;
  const day = Number.parseInt(dayStr, 10);
  const month = Number.parseInt(monthStr, 10);

  // Validate day and month ranges (before constructing the date)
  if (month < 1 || month > 12) {
    throw new Error("Fecha inválida: mes debe estar entre 01 y 12 (USE DD-MM-YYYY)");
  }
  if (day < 1 || day > 31) {
    throw new Error("Fecha inválida: día debe estar entre 01 y 31 (USE DD-MM-YYYY)");
  }

  // Build ISO date string
  const workDateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  // Validate with Date constructor (catches invalid dates like Feb 31, non-leap year Feb 29, etc)
  const testDate = new Date(`${workDateStr}T00:00:00Z`);
  if (Number.isNaN(testDate.getTime())) {
    throw new Error("Fecha inválida (ej: 31-02 no existe, 29-02 solo en años bisiesto)");
  }

  return workDateStr;
}

function validateAndParseTime(timeStr: unknown, label: string): string | null {
  if (!timeStr) {
    return null;
  }
  const time = String(timeStr).trim();
  if (!time.match(TIME_REGEX)) {
    throw new Error(`${label} inválida: ${time}. Use HH:MM format`);
  }
  return time;
}

function calculateWorkedMinutes(
  startTime: string | null,
  endTime: string | null,
  providedMinutes: unknown,
): number {
  let workedMinutes = Number(providedMinutes) || 0;
  if (!workedMinutes && startTime && endTime) {
    const startParts = startTime.split(":").map((p) => Number.parseInt(p, 10));
    const endParts = endTime.split(":").map((p) => Number.parseInt(p, 10));
    const startMin = (startParts[0] ?? 0) * 60 + (startParts[1] ?? 0);
    const endMin = (endParts[0] ?? 0) * 60 + (endParts[1] ?? 0);
    let diff = endMin - startMin;
    if (diff < 0) {
      diff += 24 * 60;
    }
    workedMinutes = Math.max(diff, 0);
  }
  return workedMinutes;
}

async function importEmployeeTimesheetsRow(
  row: CSVRow,
  mode: "insert-only" | "insert-or-update",
): Promise<ImportOutcome> {
  const person = await findPersonByRut(String(row.rut));
  if (!person) {
    throw new Error(`Empleado con RUT ${row.rut} no existe`);
  }

  const employee = await db.employee.findFirst({
    where: { person: { id: person.id } },
  });

  if (!employee) {
    throw new Error(`Empleado con RUT ${row.rut} no existe`);
  }

  const workDateStr = parseWorkDate(row.workDate);
  const startTime = validateAndParseTime(row.startTime, "Hora inicio");
  const endTime = validateAndParseTime(row.endTime, "Hora fin");
  const workedMinutes = calculateWorkedMinutes(startTime, endTime, row.workedMinutes);

  const normalizedData = normalizeTimesheetPayload({
    employee_id: employee.id,
    work_date: workDateStr,
    start_time: startTime,
    end_time: endTime,
    worked_minutes: workedMinutes,
    overtime_minutes: Number(row.overtimeMinutes) || 0,
    comment: row.comment ? String(row.comment) : null,
  });

  try {
    await upsertTimesheetEntry(normalizedData);
    return { inserted: 1, updated: 0, skipped: 0 };
  } catch (error) {
    if (mode === "insert-or-update") {
      const existing = await db.employeeTimesheet.findFirst({
        where: {
          employee: { id: employee.id },
          workDate: new Date(`${workDateStr}T00:00:00Z`),
        },
      });

      if (existing) {
        await db.employeeTimesheet.update({
          where: { id: existing.id },
          data: normalizedData,
        });
        return { inserted: 0, updated: 1, skipped: 0 };
      }
    }

    if (mode === "insert-only") {
      return { inserted: 0, updated: 0, skipped: 1 };
    }

    throw error;
  }
}
