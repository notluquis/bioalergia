/**
 * CSV Upload Routes for Hono API
 *
 * Handles bulk data import via CSV with preview and validation
 */

import { Hono } from "hono";
import { reply } from "../utils/reply";
import { verifyToken } from "../lib/paseto";
import { hasPermission } from "../auth";
import { db } from "@finanzas/db";
import { Decimal } from "decimal.js";
import dayjs from "dayjs";

const COOKIE_NAME = "finanzas_session";

export const csvUploadRoutes = new Hono();

// Table schemas for validation (simplified - use Zod in production)
type TableName =
  | "people"
  | "employees"
  | "counterparts"
  | "daily_balances"
  | "daily_production_balances"
  | "transactions"
  | "services"
  | "inventory_items"
  | "employee_timesheets";

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
}

// Helper to get auth
async function getAuth(c: {
  req: { header: (name: string) => string | undefined };
}) {
  const cookieHeader = c.req.header("Cookie");
  if (!cookieHeader) return null;
  const cookies = Object.fromEntries(
    cookieHeader.split(";").map((c) => c.trim().split("="))
  );
  const token = cookies[COOKIE_NAME];
  if (!token) return null;
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
  if (value == null || value === "") return 0;
  const str = String(value)
    .trim()
    .replace(/\$/g, "") // Remove $
    .replace(/\./g, "") // Remove dots (thousands separator in CLP)
    .replace(/,/g, "."); // Replace comma with dot (decimal separator)
  const num = Number(str);
  return isNaN(num) ? 0 : num;
}

// Parse date from DD/M/YYYY or DD/MM/YYYY format
function parseFlexibleDate(value: unknown): string | null {
  if (!value) return null;
  const str = String(value).trim();

  // Try DD/M/YYYY or DD/MM/YYYY format
  const match = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
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
const TABLE_PERMISSIONS: Record<
  TableName,
  { action: string; subject: string }
> = {
  people: { action: "create", subject: "Person" },
  employees: { action: "create", subject: "Employee" },
  counterparts: { action: "create", subject: "Counterpart" },
  daily_balances: { action: "create", subject: "DailyBalance" },
  daily_production_balances: { action: "create", subject: "ProductionBalance" },
  transactions: { action: "create", subject: "Transaction" },
  services: { action: "create", subject: "Service" },
  inventory_items: { action: "create", subject: "InventoryItem" },
  employee_timesheets: { action: "create", subject: "Timesheet" },
};

// ============================================================
// PREVIEW (VALIDATE WITHOUT INSERTING)
// ============================================================

csvUploadRoutes.post("/preview", async (c) => {
  const auth = await getAuth(c);
  if (!auth)
    return reply(c, { status: "error", message: "No autorizado" }, 401);

  const { table, data } = await c.req.json<{
    table: TableName;
    data: object[];
  }>();

  if (!table || !data || !Array.isArray(data)) {
    return reply(
      c,
      { status: "error", message: "Table and data array required" },
      400
    );
  }

  // Check permissions
  const required = TABLE_PERMISSIONS[table];
  if (required) {
    const hasPerm = await hasPermission(
      auth.userId,
      required.action,
      required.subject
    );
    if (!hasPerm)
      return reply(c, { status: "error", message: "Forbidden" }, 403);
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
        if (exists) toUpdate++;
        else toInsert++;
      } else if (
        (table === "employees" || table === "counterparts") &&
        row.rut
      ) {
        const person = await findPersonByRut(String(row.rut));
        if (!person) {
          errors.push(`Fila ${i + 1}: Persona con RUT ${row.rut} no existe`);
          toSkip++;
        } else {
          if (table === "employees" && person.employee) toUpdate++;
          else if (table === "counterparts" && person.counterpart) toUpdate++;
          else toInsert++;
        }
      } else if (table === "daily_balances" && row.date) {
        const dateStr = dayjs(String(row.date)).format("YYYY-MM-DD");
        const exists = await db.dailyBalance.findUnique({
          where: { date: new Date(dateStr) },
        });
        if (exists) toUpdate++;
        else toInsert++;
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
        if (exists) toUpdate++;
        else toInsert++;
      } else if (table === "services" && row.name) {
        // Services can have duplicate names, so just count as insert
        toInsert++;
      } else if (table === "inventory_items" && row.name) {
        const exists = await db.inventoryItem.findFirst({
          where: { name: String(row.name) },
        });
        if (exists) toUpdate++;
        else toInsert++;
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
          if (exists) toUpdate++;
          else toInsert++;
        }
      } else {
        toInsert++;
      }
    } catch (e) {
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
  if (!auth)
    return reply(c, { status: "error", message: "No autorizado" }, 401);

  const { table, data } = await c.req.json<{
    table: TableName;
    data: object[];
  }>();

  if (!table || !data || !Array.isArray(data)) {
    return reply(
      c,
      { status: "error", message: "Table and data array required" },
      400
    );
  }

  // Check permissions
  const required = TABLE_PERMISSIONS[table];
  if (required) {
    const hasPerm = await hasPermission(
      auth.userId,
      required.action,
      required.subject
    );
    if (!hasPerm)
      return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (let i = 0; i < data.length; i++) {
    const row = data[i] as CSVRow;

    try {
      if (table === "people") {
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
          updated++;
        } else {
          await db.person.create({
            data: { rut: String(row.rut), ...personData },
          });
          inserted++;
        }
      } else if (table === "employees") {
        const person = await findPersonByRut(String(row.rut));
        if (!person) {
          errors.push(`Fila ${i + 1}: Persona con RUT ${row.rut} no existe`);
          skipped++;
          continue;
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
          updated++;
        } else {
          await db.employee.create({
            data: { ...employeeData, personId: person.id },
          });
          inserted++;
        }
      } else if (table === "counterparts") {
        const person = await findPersonByRut(String(row.rut));
        if (!person) {
          errors.push(`Fila ${i + 1}: Persona con RUT ${row.rut} no existe`);
          skipped++;
          continue;
        }

        const counterpartData = {
          category: String(row.type || "SUPPLIER") as "SUPPLIER" | "CLIENT",
        };

        if (person.counterpart) {
          await db.counterpart.update({
            where: { id: person.counterpart.id },
            data: counterpartData,
          });
          updated++;
        } else {
          await db.counterpart.create({
            data: { ...counterpartData, personId: person.id },
          });
          inserted++;
        }
      } else if (table === "daily_balances") {
        const dateStr = dayjs(String(row.date)).format("YYYY-MM-DD");
        const date = new Date(dateStr);
        // DailyBalance schema only has date, amount, note
        const amountNum = Number(row.amount) || Number(row.closingBalance) || 0;
        const balanceData = {
          amount: new Decimal(amountNum.toFixed(2)),
          note: row.note ? String(row.note) : undefined,
        };

        const existing = await db.dailyBalance.findUnique({ where: { date } });
        if (existing) {
          await db.dailyBalance.update({ where: { date }, data: balanceData });
          updated++;
        } else {
          await db.dailyBalance.create({ data: { date, ...balanceData } });
          inserted++;
        }
      } else if (table === "daily_production_balances") {
        const dateStr = parseFlexibleDate(row.balanceDate || row.Fecha);
        if (!dateStr) {
          errors.push(`Fila ${i + 1}: Fecha inválida`);
          skipped++;
          continue;
        }
        const balanceDate = new Date(dateStr);

        const productionData = {
          ingresoTarjetas: cleanAmount(
            row.ingresoTarjetas || row["INGRESO TARJETAS"]
          ),
          ingresoTransferencias: cleanAmount(
            row.ingresoTransferencias || row["INGRESO TRANSFERENCIAS"]
          ),
          ingresoEfectivo: cleanAmount(
            row.ingresoEfectivo || row["INGRESO EFECTIVO"]
          ),
          gastosDiarios: cleanAmount(
            row.gastosDiarios || row["GASTOS DIARIOS"]
          ),
          otrosAbonos: cleanAmount(row.otrosAbonos || row["Otros/abonos"]),
          consultasMonto: cleanAmount(row.consultasMonto || row.CONSULTAS),
          controlesMonto: cleanAmount(row.controlesMonto || row.CONTROLES),
          testsMonto: cleanAmount(row.testsMonto || row.TEST),
          vacunasMonto: cleanAmount(row.vacunasMonto || row.VACUNAS),
          licenciasMonto: cleanAmount(row.licenciasMonto || row.LICENCIAS),
          roxairMonto: cleanAmount(row.roxairMonto || row.ROXAIR),
          comentarios:
            row.comentarios || row.Comentarios
              ? String(row.comentarios || row.Comentarios)
              : null,
          status: (row.status as "DRAFT" | "FINAL") || "DRAFT",
          changeReason: row.changeReason ? String(row.changeReason) : null,
        };

        const existing = await db.dailyProductionBalance.findUnique({
          where: { balanceDate },
        });
        if (existing) {
          await db.dailyProductionBalance.update({
            where: { balanceDate },
            data: productionData,
          });
          updated++;
        } else {
          await db.dailyProductionBalance.create({
            data: {
              balanceDate,
              ...productionData,
              createdBy: auth.userId,
            },
          });
          inserted++;
        }
      } else if (table === "services") {
        const person = row.rut ? await findPersonByRut(String(row.rut)) : null;
        const serviceData = {
          name: String(row.name),
          serviceType: String(row.type || "BUSINESS") as
            | "BUSINESS"
            | "PERSONAL",
          frequency: String(row.frequency || "MONTHLY") as
            | "MONTHLY"
            | "ONCE"
            | "ANNUAL",
          defaultAmount: row.defaultAmount
            ? new Decimal(Number(row.defaultAmount))
            : new Decimal(0),
          status: String(row.status || "ACTIVE") as
            | "ACTIVE"
            | "INACTIVE"
            | "ARCHIVED",
          counterpartId: person?.counterpart?.id || null,
        };

        await db.service.create({ data: serviceData });
        inserted++;
      } else if (table === "inventory_items") {
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
          updated++;
        } else {
          await db.inventoryItem.create({ data: itemData });
          inserted++;
        }
      } else if (table === "employee_timesheets") {
        const person = await findPersonByRut(String(row.rut));
        if (!person?.employee) {
          errors.push(`Fila ${i + 1}: Empleado con RUT ${row.rut} no existe`);
          skipped++;
          continue;
        }

        const dateStr = dayjs(String(row.workDate)).format("YYYY-MM-DD");
        const workDate = new Date(dateStr);

        // Parse times if provided
        const startTime = row.startTime
          ? new Date(`1970-01-01T${row.startTime}`)
          : null;
        const endTime = row.endTime
          ? new Date(`1970-01-01T${row.endTime}`)
          : null;

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
          updated++;
        } else {
          await db.employeeTimesheet.create({ data: timesheetData });
          inserted++;
        }
      } else {
        skipped++;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error desconocido";
      errors.push(`Fila ${i + 1}: ${msg}`);
      skipped++;
    }
  }

  console.log(
    "[CSV] Import by",
    auth.email,
    ":",
    table,
    "- inserted:",
    inserted,
    "updated:",
    updated,
    "skipped:",
    skipped
  );
  return reply(c, {
    status: "ok",
    inserted,
    updated,
    skipped,
    errors: errors.slice(0, 20),
  });
});
