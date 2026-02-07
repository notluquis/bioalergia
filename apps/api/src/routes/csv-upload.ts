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
import { verifyToken } from "../lib/paseto";
import { reply } from "../utils/reply";

const COOKIE_NAME = "finanzas_session";
const CURRENCY_DOLLAR_REGEX = /\$/g;
const THOUSANDS_DOT_REGEX = /\./g;
const DECIMAL_COMMA_REGEX = /,/g;
const SLASH_DATE_REGEX = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

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
}

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
    include: { employee: true, counterpart: true },
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

  const { table, data, period } = await c.req.json<{
    table: TableName;
    data: object[];
    period?: string;
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

  // Log preview request with period if provided
  if (period) {
    console.log(`[CSV Preview] Table: ${table}, Period: ${period}, Rows: ${data.length}`);
  }

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
          toUpdate++;
        } else {
          toInsert++;
        }
      } else if ((table === "employees" || table === "counterparts") && row.rut) {
        const person = await findPersonByRut(String(row.rut));
        if (!person) {
          errors.push(`Fila ${i + 1}: Persona con RUT ${row.rut} no existe`);
          toSkip++;
        } else {
          if (table === "employees" && person.employee) {
            toUpdate++;
          } else if (table === "counterparts" && person.counterpart) {
            toUpdate++;
          } else {
            toInsert++;
          }
        }
      } else if (table === "daily_balances" && row.date) {
        const dateStr = dayjs(String(row.date)).format("YYYY-MM-DD");
        const exists = await db.dailyBalance.findUnique({
          where: { date: new Date(dateStr) },
        });
        if (exists) {
          toUpdate++;
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
          toUpdate++;
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
          toUpdate++;
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
          toUpdate++;
        } else {
          toInsert++;
        }
      } else if (table === "employee_timesheets" && row.rut && row.workDate) {
        const person = await findPersonByRut(String(row.rut));
        if (!person?.employee) {
          errors.push(`Fila ${i + 1}: Empleado con RUT ${row.rut} no existe`);
          toSkip++;
        } else {
          const dateStr = dayjs(String(row.workDate)).format("YYYY-MM-DD");
          const exists = await db.employeeTimesheet.findFirst({
            where: {
              employeeId: person.employee.id,
              workDate: new Date(dateStr),
            },
          });
          if (exists) {
            toUpdate++;
          } else {
            toInsert++;
          }
        }
      } else if (table === "dte_purchases" && row.period && row.providerRUT && row.folio) {
        // DTE Purchases are identified by period + providerRUT + folio + documentDate
        const dateStr = parseFlexibleDate(row.documentDate);
        if (!dateStr) {
          errors.push(`Fila ${i + 1}: Fecha de documento inválida`);
          toSkip++;
          continue;
        }
        const exists = await db.dtePurchaseDetail.findFirst({
          where: {
            period: String(row.period),
            providerRUT: String(row.providerRUT),
            folio: String(row.folio),
            documentDate: new Date(dateStr),
          },
        });
        if (exists) {
          toUpdate++;
        } else {
          toInsert++;
        }
      } else if (table === "dte_sales" && row.period && row.clientRUT && row.folio) {
        // DTE Sales are identified by period + clientRUT + folio + documentDate
        const dateStr = parseFlexibleDate(row.documentDate);
        if (!dateStr) {
          errors.push(`Fila ${i + 1}: Fecha de documento inválida`);
          toSkip++;
          continue;
        }
        const exists = await db.dteSaleDetail.findFirst({
          where: {
            period: String(row.period),
            clientRUT: String(row.clientRUT),
            folio: String(row.folio),
            documentDate: new Date(dateStr),
          },
        });
        if (exists) {
          toUpdate++;
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

  const { table, data, period } = await c.req.json<{
    table: TableName;
    data: object[];
    period?: string;
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

  const { inserted, updated, skipped, errors } = await importCsvRows(table, data, auth);

  console.log(
    "[CSV] Import by",
    auth.email,
    ":",
    table,
    period ? `[Period: ${period}]` : "",
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
): Promise<ImportResult> {
  const totals = emptyOutcome();
  const errors: string[] = [];

  for (let i = 0; i < data.length; i++) {
    const row = data[i] as CSVRow;
    try {
      const outcome = await importCsvRow(table, row, auth);
      addOutcome(totals, outcome);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Error desconocido";
      errors.push(`Fila ${i + 1}: ${msg}`);
      totals.skipped += 1;
    }
  }

  return { ...totals, errors };
}

type ImportRowHandler = (row: CSVRow, auth: AuthContext) => Promise<ImportOutcome>;

const importRowHandlers: Record<TableName, ImportRowHandler> = {
  people: (row) => importPeopleRow(row),
  employees: (row) => importEmployeesRow(row),
  counterparts: (row) => importCounterpartsRow(row),
  daily_balances: (row) => importDailyBalancesRow(row),
  daily_production_balances: (row, auth) => importDailyProductionBalancesRow(row, auth.userId),
  transactions: async () => ({ inserted: 0, updated: 0, skipped: 1 }),
  withdrawals: (row) => importWithdrawalsRow(row),
  services: (row) => importServicesRow(row),
  inventory_items: (row) => importInventoryItemsRow(row),
  employee_timesheets: (row) => importEmployeeTimesheetsRow(row),
  dte_purchases: (row) => importDtePurchaseRow(row),
  dte_sales: (row) => importDteSaleRow(row),
};

async function importCsvRow(
  table: TableName,
  row: CSVRow,
  auth: AuthContext,
): Promise<ImportOutcome> {
  const handler = importRowHandlers[table];
  return handler ? handler(row, auth) : { inserted: 0, updated: 0, skipped: 1 };
}

async function importPeopleRow(row: CSVRow): Promise<ImportOutcome> {
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

async function importEmployeesRow(row: CSVRow): Promise<ImportOutcome> {
  const person = await findPersonByRut(String(row.rut));
  if (!person) {
    throw new Error(`Persona con RUT ${row.rut} no existe`);
  }

  const employeeData = {
    position: row.position ? String(row.position) : "No especificado",
    startDate: row.startDate
      ? new Date(dayjs(String(row.startDate)).format("YYYY-MM-DD"))
      : new Date(),
    status: "ACTIVE" as const,
  };

  if (person.employee) {
    await db.employee.update({
      where: { id: person.employee.id },
      data: employeeData,
    });
    return { inserted: 0, updated: 1, skipped: 0 };
  }

  await db.employee.create({
    data: { ...employeeData, personId: person.id },
  });
  return { inserted: 1, updated: 0, skipped: 0 };
}

async function importCounterpartsRow(row: CSVRow): Promise<ImportOutcome> {
  const person = await findPersonByRut(String(row.rut));
  if (!person) {
    throw new Error(`Persona con RUT ${row.rut} no existe`);
  }

  const counterpartData = {
    category: String(row.type || "SUPPLIER") as "SUPPLIER" | "CLIENT",
  };

  if (person.counterpart) {
    await db.counterpart.update({
      where: { id: person.counterpart.id },
      data: counterpartData,
    });
    return { inserted: 0, updated: 1, skipped: 0 };
  }

  await db.counterpart.create({
    data: { ...counterpartData, personId: person.id },
  });
  return { inserted: 1, updated: 0, skipped: 0 };
}

async function importDailyBalancesRow(row: CSVRow): Promise<ImportOutcome> {
  const dateStr = dayjs(String(row.date)).format("YYYY-MM-DD");
  const date = new Date(dateStr);
  const amountNum = Number(row.amount) || Number(row.closingBalance) || 0;
  const balanceData = {
    amount: new Decimal(amountNum.toFixed(2)),
    note: row.note ? String(row.note) : undefined,
  };

  const existing = await db.dailyBalance.findUnique({ where: { date } });
  if (existing) {
    await db.dailyBalance.update({ where: { date }, data: balanceData });
    return { inserted: 0, updated: 1, skipped: 0 };
  }

  await db.dailyBalance.create({ data: { date, ...balanceData } });
  return { inserted: 1, updated: 0, skipped: 0 };
}

async function importDailyProductionBalancesRow(
  row: CSVRow,
  userId: number,
): Promise<ImportOutcome> {
  const balanceDate = parseProductionBalanceDate(row);
  const productionData = buildProductionBalanceData(row);
  const existing = await db.dailyProductionBalance.findUnique({
    where: { balanceDate },
  });

  if (existing) {
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

async function importWithdrawalsRow(row: CSVRow): Promise<ImportOutcome> {
  if (!row.withdrawId) {
    throw new Error("withdrawId requerido");
  }

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
  const withdrawData = {
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

  const withdrawId = String(row.withdrawId);
  const existing = await db.withdrawTransaction.findUnique({
    where: { withdrawId },
  });

  if (existing) {
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
  const person = row.rut ? await findPersonByRut(String(row.rut)) : null;
  const serviceData = {
    name: String(row.name),
    serviceType: String(row.type || "BUSINESS") as "BUSINESS" | "PERSONAL",
    frequency: String(row.frequency || "MONTHLY") as "MONTHLY" | "ONCE" | "ANNUAL",
    defaultAmount: row.defaultAmount ? new Decimal(Number(row.defaultAmount)) : new Decimal(0),
    status: String(row.status || "ACTIVE") as "ACTIVE" | "INACTIVE" | "ARCHIVED",
    counterpartId: person?.counterpart?.id || null,
  };

  await db.service.create({ data: serviceData });
  return { inserted: 1, updated: 0, skipped: 0 };
}

async function importInventoryItemsRow(row: CSVRow): Promise<ImportOutcome> {
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
    await db.inventoryItem.update({
      where: { id: existing.id },
      data: itemData,
    });
    return { inserted: 0, updated: 1, skipped: 0 };
  }

  await db.inventoryItem.create({ data: itemData });
  return { inserted: 1, updated: 0, skipped: 0 };
}

async function importEmployeeTimesheetsRow(row: CSVRow): Promise<ImportOutcome> {
  const person = await findPersonByRut(String(row.rut));
  if (!person?.employee) {
    throw new Error(`Empleado con RUT ${row.rut} no existe`);
  }

  const dateStr = dayjs(String(row.workDate)).format("YYYY-MM-DD");
  const workDate = new Date(dateStr);

  const startTime = row.startTime ? new Date(`1970-01-01T${row.startTime}`) : null;
  const endTime = row.endTime ? new Date(`1970-01-01T${row.endTime}`) : null;

  const timesheetData = {
    employeeId: person.employee.id,
    workDate,
    startTime,
    endTime,
    workedMinutes: Number(row.workedMinutes) || 0,
    overtimeMinutes: Number(row.overtimeMinutes) || 0,
    comment: row.comment ? String(row.comment) : null,
  };

  const existing = await db.employeeTimesheet.findFirst({
    where: {
      employeeId: person.employee.id,
      workDate,
    },
  });

  if (existing) {
    await db.employeeTimesheet.update({
      where: { id: existing.id },
      data: timesheetData,
    });
    return { inserted: 0, updated: 1, skipped: 0 };
  }

  await db.employeeTimesheet.create({ data: timesheetData });
  return { inserted: 1, updated: 0, skipped: 0 };
}
async function importDtePurchaseRow(row: CSVRow): Promise<ImportOutcome> {
  // Validate required fields
  if (!row.period || !row.providerRUT || !row.folio) {
    throw new Error("Campos requeridos faltantes: period, providerRUT, folio");
  }

  const documentDateStr = parseFlexibleDate(row.documentDate);
  const receiptDateStr = parseFlexibleDate(row.receiptDate);

  if (!documentDateStr || !receiptDateStr) {
    throw new Error("Fechas inválidas: documentDate o receiptDate");
  }

  const documentDate = new Date(documentDateStr);
  const receiptDate = new Date(receiptDateStr);

  const purchaseData = buildDtePurchaseData(row, documentDate, receiptDate);

  const existing = await db.dtePurchaseDetail.findFirst({
    where: {
      period: purchaseData.period,
      providerRUT: purchaseData.providerRUT,
      folio: purchaseData.folio,
      documentDate: purchaseData.documentDate,
    },
  });

  if (existing) {
    await db.dtePurchaseDetail.update({
      where: { id: existing.id },
      data: purchaseData,
    });
    return { inserted: 0, updated: 1, skipped: 0 };
  }

  await db.dtePurchaseDetail.create({ data: purchaseData });
  return { inserted: 1, updated: 0, skipped: 0 };
}

function buildDtePurchaseData(row: CSVRow, documentDate: Date, receiptDate: Date) {
  const acknowledgeDate = row.acknowledgeDate
    ? new Date(parseFlexibleDate(row.acknowledgeDate) || "")
    : null;

  return {
    period: String(row.period),
    registerNumber: Number(row.registerNumber) || 0,
    documentType: Number(row.documentType) || 33,
    purchaseType: String(row.purchaseType || "Compras del Giro"),
    providerRUT: String(row.providerRUT),
    providerName: String(row.providerName || ""),
    folio: String(row.folio),
    documentDate,
    receiptDate,
    acknowledgeDate,
    exemptAmount: new Decimal(cleanAmount(row.exemptAmount)),
    netAmount: new Decimal(cleanAmount(row.netAmount)),
    recoverableIVA: new Decimal(cleanAmount(row.recoverableIVA)),
    nonRecoverableIVA: new Decimal(cleanAmount(row.nonRecoverableIVA)),
    nonRecoverableIVACode: row.nonRecoverableIVACode ? String(row.nonRecoverableIVACode) : null,
    totalAmount: new Decimal(cleanAmount(row.totalAmount)),
    fixedAssetNetAmount: new Decimal(cleanAmount(row.fixedAssetNetAmount)),
    commonUseIVA: new Decimal(cleanAmount(row.commonUseIVA)),
    nonCreditableTax: new Decimal(cleanAmount(row.nonCreditableTax)),
    nonRetainedIVA: new Decimal(cleanAmount(row.nonRetainedIVA)),
    referenceDocNote: row.referenceDocNote ? String(row.referenceDocNote) : null,
    notes: row.notes ? String(row.notes) : null,
  };
}

async function importDteSaleRow(row: CSVRow): Promise<ImportOutcome> {
  // Validate required fields
  if (!row.period || !row.clientRUT || !row.folio) {
    throw new Error("Campos requeridos faltantes: period, clientRUT, folio");
  }

  const documentDateStr = parseFlexibleDate(row.documentDate);
  const receiptDateStr = parseFlexibleDate(row.receiptDate);

  if (!documentDateStr || !receiptDateStr) {
    throw new Error("Fechas inválidas: documentDate o receiptDate");
  }

  const documentDate = new Date(documentDateStr);
  const receiptDate = new Date(receiptDateStr);

  const saleData = buildDteSaleData(row, documentDate, receiptDate);

  const existing = await db.dteSaleDetail.findFirst({
    where: {
      period: saleData.period,
      clientRUT: saleData.clientRUT,
      folio: saleData.folio,
      documentDate: saleData.documentDate,
    },
  });

  if (existing) {
    await db.dteSaleDetail.update({
      where: { id: existing.id },
      data: saleData,
    });
    return { inserted: 0, updated: 1, skipped: 0 };
  }

  await db.dteSaleDetail.create({ data: saleData });
  return { inserted: 1, updated: 0, skipped: 0 };
}

function buildDteSaleData(row: CSVRow, documentDate: Date, receiptDate: Date) {
  const receiptAcknowledgeDate = row.receiptAcknowledgeDate
    ? new Date(parseFlexibleDate(row.receiptAcknowledgeDate) || "")
    : null;
  const claimDate = row.claimDate ? new Date(parseFlexibleDate(row.claimDate) || "") : null;

  return {
    // Identifiers
    period: String(row.period),
    registerNumber: Number(row.registerNumber) || 0,
    documentType: Number(row.documentType) || 41,
    saleType: String(row.saleType || "Del Giro"),
    clientRUT: String(row.clientRUT),
    clientName: String(row.clientName || ""),
    folio: String(row.folio),
    documentDate,
    receiptDate,
    receiptAcknowledgeDate,
    claimDate,
    // Main amounts
    exemptAmount: new Decimal(cleanAmount(row.exemptAmount)),
    netAmount: new Decimal(cleanAmount(row.netAmount)),
    ivaAmount: new Decimal(cleanAmount(row.ivaAmount)),
    totalAmount: new Decimal(cleanAmount(row.totalAmount)),
    // IVA details
    ...buildDteSaleIvaFields(row),
    // Commission
    ...buildDteSaleCommissionFields(row),
    // References
    referenceDocType: row.referenceDocType ? String(row.referenceDocType) : null,
    referenceDocFolio: row.referenceDocFolio ? String(row.referenceDocFolio) : null,
    // Foreign buyer
    ...buildDteSaleForeignBuyerFields(row),
    // Special conditions
    ...buildDteSaleSpecialFields(row),
    // Metadata
    ...buildDteSaleMetadataFields(row),
  };
}

function buildDteSaleForeignBuyerFields(row: CSVRow) {
  return {
    foreignBuyerIdentifier: row.foreignBuyerIdentifier ? String(row.foreignBuyerIdentifier) : null,
    foreignBuyerNationality: row.foreignBuyerNationality
      ? String(row.foreignBuyerNationality)
      : null,
  };
}

function buildDteSaleMetadataFields(row: CSVRow) {
  return {
    internalNumber: row.internalNumber ? Number(row.internalNumber) : null,
    branchCode: row.branchCode ? String(row.branchCode) : null,
    purchaseId: row.purchaseId ? String(row.purchaseId) : null,
    shippingOrderId: row.shippingOrderId ? String(row.shippingOrderId) : null,
    origin: row.origin ? String(row.origin) : null,
    informativeNote: row.informativeNote ? String(row.informativeNote) : null,
    paymentNote: row.paymentNote ? String(row.paymentNote) : null,
    notes: row.notes ? String(row.notes) : null,
  };
}

function buildDteSaleIvaFields(row: CSVRow) {
  return {
    totalRetainedIVA: new Decimal(cleanAmount(row.totalRetainedIVA)),
    partialRetainedIVA: new Decimal(cleanAmount(row.partialRetainedIVA)),
    nonRetainedIVA: new Decimal(cleanAmount(row.nonRetainedIVA)),
    ownIVA: new Decimal(cleanAmount(row.ownIVA)),
    thirdPartyIVA: new Decimal(cleanAmount(row.thirdPartyIVA)),
    lateIVA: new Decimal(cleanAmount(row.lateIVA)),
  };
}

function buildDteSaleCommissionFields(row: CSVRow) {
  return {
    emitterRUT: row.emitterRUT ? String(row.emitterRUT) : null,
    commissionNetAmount: new Decimal(cleanAmount(row.commissionNetAmount)),
    commissionExemptAmount: new Decimal(cleanAmount(row.commissionExemptAmount)),
    commissionIVA: new Decimal(cleanAmount(row.commissionIVA)),
  };
}

function buildDteSaleSpecialFields(row: CSVRow) {
  return {
    constructorCreditAmount: new Decimal(cleanAmount(row.constructorCreditAmount)),
    freeTradeZoneAmount: new Decimal(cleanAmount(row.freeTradeZoneAmount)),
    containerGuaranteeAmount: new Decimal(cleanAmount(row.containerGuaranteeAmount)),
    nonBillableAmount: new Decimal(cleanAmount(row.nonBillableAmount)),
    transportPassageAmount: new Decimal(cleanAmount(row.transportPassageAmount)),
    internationalTransportAmount: new Decimal(cleanAmount(row.internationalTransportAmount)),
  };
}
