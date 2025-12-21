/**
 * CSV Upload Schemas
 * Validation schemas for each entity type that can be bulk imported
 */
import { z } from "zod";

/**
 * Convert various numeric-like values to integers, handling currency formats
 */
export const toInt = (val: unknown): number => {
  if (typeof val === "number") return Math.round(val);
  if (typeof val !== "string") return 0;
  const cleaned = val.replace(/[^0-9-]/g, "");
  const num = Number(cleaned);
  if (!Number.isFinite(num)) return 0;
  return Math.round(num);
};

/**
 * Normalize date strings from CSV (DD/MM/YYYY or ISO format) to YYYY-MM-DD
 */
export const normalizeCsvDate = (raw: string, ctx: z.RefinementCtx): string => {
  const value = (raw || "").toString().trim();
  let date: Date | null = null;

  // Accept DD/MM/YYYY or ISO-like strings
  const ddmmyyyy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
  const match = value.match(ddmmyyyy);
  if (match) {
    const [, d, m, y] = match;
    const day = Number(d);
    const month = Number(m) - 1;
    const year = Number(y);
    date = new Date(year, month, day);
  } else if (!Number.isNaN(Date.parse(value))) {
    date = new Date(value);
  }

  if (!date || Number.isNaN(date.getTime())) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Fecha inválida" });
    return z.NEVER;
  }

  return date.toISOString().slice(0, 10);
};

/**
 * Table schemas for CSV validation
 */
export const TABLE_SCHEMAS = {
  people: z.object({
    rut: z.string().min(1),
    names: z.string().min(1),
    fatherName: z.string().optional(),
    motherName: z.string().optional(),
    email: z.string().email().optional().or(z.literal("")),
    phone: z.string().optional(),
    address: z.string().optional(),
    personType: z.enum(["NATURAL", "JURIDICAL"]).optional(),
  }),
  employees: z.object({
    rut: z.string().min(1),
    position: z.string().min(1),
    department: z.string().optional(),
    startDate: z.string().refine((d) => !isNaN(Date.parse(d))),
    endDate: z
      .string()
      .refine((d) => !isNaN(Date.parse(d)))
      .optional()
      .or(z.literal("")),
    status: z.enum(["ACTIVE", "INACTIVE", "TERMINATED"]).optional(),
    salaryType: z.enum(["HOURLY", "FIXED"]).optional(),
    baseSalary: z.coerce.number().optional(),
    hourlyRate: z.coerce.number().optional(),
    overtimeRate: z.coerce.number().optional(),
    retentionRate: z.coerce.number().optional(),
    bankName: z.string().optional(),
    bankAccountType: z.string().optional(),
    bankAccountNumber: z.string().optional(),
  }),
  counterparts: z.object({
    rut: z.string().min(1),
    category: z
      .enum(["SUPPLIER", "PATIENT", "EMPLOYEE", "PARTNER", "RELATED", "OTHER", "CLIENT", "LENDER", "OCCASIONAL"])
      .optional(),
    notes: z.string().optional(),
  }),
  transactions: z.object({
    timestamp: z.string().refine((d) => !isNaN(Date.parse(d))),
    description: z.string().optional(),
    amount: z.coerce.number(),
    direction: z.enum(["IN", "OUT", "NEUTRO"]),
    rut: z.string().optional(),
    origin: z.string().optional(),
    destination: z.string().optional(),
    category: z.string().optional(),
  }),
  daily_balances: z.object({
    date: z.string().transform((val, ctx) => normalizeCsvDate(val, ctx)),
    amount: z.coerce.number(),
    note: z.string().optional(),
  }),
  daily_production_balances: z.object({
    balanceDate: z.string().transform((val, ctx) => normalizeCsvDate(val, ctx)),
    ingresoTarjetas: z.union([z.string(), z.number()]).transform((v) => toInt(v)),
    ingresoTransferencias: z.union([z.string(), z.number()]).transform((v) => toInt(v)),
    ingresoEfectivo: z.union([z.string(), z.number()]).transform((v) => toInt(v)),
    gastosDiarios: z.union([z.string(), z.number()]).transform((v) => toInt(v)),
    otrosAbonos: z.union([z.string(), z.number()]).transform((v) => toInt(v)),
    consultasMonto: z.union([z.string(), z.number()]).transform((v) => toInt(v)),
    controlesMonto: z.union([z.string(), z.number()]).transform((v) => toInt(v)),
    testsMonto: z.union([z.string(), z.number()]).transform((v) => toInt(v)),
    vacunasMonto: z.union([z.string(), z.number()]).transform((v) => toInt(v)),
    licenciasMonto: z.union([z.string(), z.number()]).transform((v) => toInt(v)),
    roxairMonto: z.union([z.string(), z.number()]).transform((v) => toInt(v)),
    comentarios: z.string().optional(),
    status: z.enum(["DRAFT", "FINAL"]).default("DRAFT"),
    changeReason: z.string().optional(),
  }),
  services: z.object({
    name: z.string().min(1),
    rut: z.string().optional(),
    type: z.enum(["BUSINESS", "PERSONAL", "SUPPLIER", "TAX", "UTILITY", "LEASE", "SOFTWARE", "OTHER"]).optional(),
    frequency: z
      .enum(["WEEKLY", "BIWEEKLY", "MONTHLY", "BIMONTHLY", "QUARTERLY", "SEMIANNUAL", "ANNUAL", "ONCE"])
      .optional(),
    defaultAmount: z.coerce.number().optional(),
    status: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]).optional(),
  }),
  inventory_items: z.object({
    categoryId: z.coerce.number().optional(),
    name: z.string().min(1),
    description: z.string().optional(),
    currentStock: z.coerce.number().optional(),
  }),
  employee_timesheets: z.object({
    rut: z.string().min(1),
    workDate: z.string().refine((d) => !isNaN(Date.parse(d))),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    workedMinutes: z.coerce.number(),
    overtimeMinutes: z.coerce.number().optional(),
    comment: z.string().optional(),
  }),
};

export type TableName = keyof typeof TABLE_SCHEMAS;
