import { db } from "@finanzas/db";

import { isoToDbDate, parseChileDateTime } from "../lib/time.ts";

type CsvRow = Record<string, number | string>;

export type ProductionBalanceImportMode = "insert-only" | "insert-or-update" | "update-only";

export type ProductionBalanceImportRow = {
  balanceDate: Date;
  comentarios: null | string;
  consultasMonto: number;
  controlesMonto: number;
  dateKey: string; // YYYY-MM-DD, clave de upsert
  gastosDiarios: number;
  ingresoEfectivo: number;
  ingresoTarjetas: number;
  ingresoTransferencias: number;
  licenciasMonto: number;
  otrosAbonos: number;
  roxairMonto: number;
  rowIndex: number;
  testsMonto: number;
  vacunasMonto: number;
};

const MONTH_BY_NAME: Record<string, number> = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
};

// "martes, 28 enero 2025" / "miércoles, 29 de enero de 2025" (export de
// Google Sheets con formato largo es-CL). El día de semana se ignora.
const SPANISH_LONG_DATE_REGEX = /^\p{L}+,?\s+(\d{1,2})\s+(?:de\s+)?(\p{L}+)\s+(?:de\s+)?(\d{4})$/u;

export function parseSpanishLongDate(value: string): null | string {
  const match = SPANISH_LONG_DATE_REGEX.exec(value.trim().toLowerCase());
  if (!match) {
    return null;
  }
  const [, day, monthName, year] = match;
  const month = MONTH_BY_NAME[monthName ?? ""];
  if (!month || !day || !year) {
    return null;
  }
  const dayNum = Number(day);
  if (dayNum < 1 || dayNum > 31) {
    return null;
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
}

/** "$75.000" / "$ 75.000" / "75.000" / 75000 → entero CLP (0 si vacío). */
function normalizeMoney(value: number | string | undefined): null | number {
  if (value == null || value === "") {
    return 0;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.round(value) : null;
  }
  const cleaned = value.replace(/[$\s]/g, "").replaceAll(".", "").replace(",", ".");
  if (!cleaned) {
    return 0;
  }
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

function normalizeComentarios(value: number | string | undefined): null | string {
  if (value == null) {
    return null;
  }
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

const MONEY_FIELDS = [
  "ingresoTarjetas",
  "ingresoTransferencias",
  "ingresoEfectivo",
  "gastosDiarios",
  "otrosAbonos",
  "consultasMonto",
  "controlesMonto",
  "testsMonto",
  "vacunasMonto",
  "licenciasMonto",
  "roxairMonto",
] as const;

type MoneyField = (typeof MONEY_FIELDS)[number];

export function parseProductionBalanceRows(rows: CsvRow[]): {
  emptyRows: number;
  errors: string[];
  validRows: ProductionBalanceImportRow[];
} {
  const errors: string[] = [];
  const validRows: ProductionBalanceImportRow[] = [];
  const seenDates = new Set<string>();
  let emptyRows = 0;

  rows.forEach((row, index) => {
    const rowNumber = index + 1;
    const rawDate = row.balanceDate;

    // Filas totalmente vacías (el sheet exporta cientos de filas sin fecha ni
    // valores al final) se omiten en silencio — error solo si HAY datos.
    const hasAnyValue = Object.entries(row).some(
      ([key, value]) => key !== "balanceDate" && String(value ?? "").trim() !== ""
    );
    const rawDateText = String(rawDate ?? "").trim();
    if (!rawDateText && !hasAnyValue) {
      emptyRows += 1;
      return;
    }

    const isoFromSpanish = rawDateText ? parseSpanishLongDate(rawDateText) : null;
    const parsedDate = isoFromSpanish
      ? isoToDbDate(isoFromSpanish)
      : parseChileDateTime(rawDateText);

    if (!parsedDate || Number.isNaN(parsedDate.getTime())) {
      errors.push(`Fila ${rowNumber}: balanceDate inválida ("${rawDateText}").`);
      return;
    }

    const dateKey = isoFromSpanish ?? parsedDate.toISOString().slice(0, 10);
    if (seenDates.has(dateKey)) {
      errors.push(`Fila ${rowNumber}: fecha duplicada en el archivo (${dateKey}).`);
      return;
    }
    seenDates.add(dateKey);

    const money = {} as Record<MoneyField, number>;
    for (const field of MONEY_FIELDS) {
      const normalized = normalizeMoney(row[field]);
      if (normalized == null) {
        errors.push(`Fila ${rowNumber}: monto inválido en ${field} ("${String(row[field])}").`);
        return;
      }
      money[field] = normalized;
    }

    const comentarios = normalizeComentarios(row.comentarios);

    // Filas-plantilla del sheet (fecha futura pre-creada, todo $0, sin
    // comentario) no aportan información — se omiten, no se insertan.
    if (comentarios === null && MONEY_FIELDS.every((field) => money[field] === 0)) {
      emptyRows += 1;
      return;
    }

    validRows.push({
      balanceDate: isoToDbDate(dateKey),
      comentarios,
      dateKey,
      rowIndex: index,
      ...money,
    });
  });

  return { emptyRows, errors, validRows };
}

type ExistingBalance = {
  comentarios: null | string;
  id: number;
} & Record<MoneyField, number>;

function rowEqualsExisting(row: ProductionBalanceImportRow, existing: ExistingBalance): boolean {
  // Comentarios normalizados a ambos lados: filas históricas en DB traen
  // espacios finales que no son una diferencia real.
  const existingComentarios = existing.comentarios?.trim() || null;
  return (
    MONEY_FIELDS.every((field) => row[field] === existing[field]) &&
    (row.comentarios ?? null) === existingComentarios
  );
}

export async function classifyProductionBalanceRows(rows: ProductionBalanceImportRow[]): Promise<{
  insertRows: ProductionBalanceImportRow[];
  unchangedRows: ProductionBalanceImportRow[];
  updateRows: Array<{ existingId: number; row: ProductionBalanceImportRow }>;
}> {
  if (rows.length === 0) {
    return { insertRows: [], unchangedRows: [], updateRows: [] };
  }

  const existing = await db.dailyProductionBalance.findMany({
    where: { balanceDate: { in: rows.map((row) => row.balanceDate) } },
    select: {
      balanceDate: true,
      comentarios: true,
      consultasMonto: true,
      controlesMonto: true,
      gastosDiarios: true,
      id: true,
      ingresoEfectivo: true,
      ingresoTarjetas: true,
      ingresoTransferencias: true,
      licenciasMonto: true,
      otrosAbonos: true,
      roxairMonto: true,
      testsMonto: true,
      vacunasMonto: true,
    },
  });

  const existingByDate = new Map<string, ExistingBalance>(
    existing.map((row: (typeof existing)[number]) => [
      row.balanceDate.toISOString().slice(0, 10),
      row,
    ])
  );

  const insertRows: ProductionBalanceImportRow[] = [];
  const unchangedRows: ProductionBalanceImportRow[] = [];
  const updateRows: Array<{ existingId: number; row: ProductionBalanceImportRow }> = [];

  for (const row of rows) {
    const found = existingByDate.get(row.dateKey);
    if (!found) {
      insertRows.push(row);
    } else if (rowEqualsExisting(row, found)) {
      unchangedRows.push(row);
    } else {
      updateRows.push({ existingId: found.id, row });
    }
  }

  return { insertRows, unchangedRows, updateRows };
}

export function summarizeProductionBalanceRow(row: ProductionBalanceImportRow): string {
  const total = row.ingresoTarjetas + row.ingresoTransferencias + row.ingresoEfectivo;
  return `${row.dateKey} · $${total.toLocaleString("es-CL")}`;
}

export async function importProductionBalances(params: {
  mode: ProductionBalanceImportMode;
  rows: ProductionBalanceImportRow[];
  userId: number;
}): Promise<{ inserted: number; skipped: number; updated: number }> {
  const { insertRows, unchangedRows, updateRows } = await classifyProductionBalanceRows(
    params.rows
  );

  let inserted = 0;
  let updated = 0;
  // Filas idénticas a lo ya guardado nunca se reescriben.
  let skipped = unchangedRows.length;

  if (params.mode === "update-only") {
    skipped += insertRows.length;
  } else {
    for (const row of insertRows) {
      await db.dailyProductionBalance.create({
        data: {
          balanceDate: row.balanceDate,
          comentarios: row.comentarios,
          consultasMonto: row.consultasMonto,
          controlesMonto: row.controlesMonto,
          createdBy: params.userId,
          gastosDiarios: row.gastosDiarios,
          ingresoEfectivo: row.ingresoEfectivo,
          ingresoTarjetas: row.ingresoTarjetas,
          ingresoTransferencias: row.ingresoTransferencias,
          licenciasMonto: row.licenciasMonto,
          otrosAbonos: row.otrosAbonos,
          roxairMonto: row.roxairMonto,
          status: "DRAFT",
          testsMonto: row.testsMonto,
          vacunasMonto: row.vacunasMonto,
        },
      });
      inserted += 1;
    }
  }

  if (params.mode === "insert-only") {
    skipped += updateRows.length;
  } else {
    for (const { existingId, row } of updateRows) {
      await db.dailyProductionBalance.update({
        where: { id: existingId },
        data: {
          comentarios: row.comentarios,
          consultasMonto: row.consultasMonto,
          controlesMonto: row.controlesMonto,
          gastosDiarios: row.gastosDiarios,
          ingresoEfectivo: row.ingresoEfectivo,
          ingresoTarjetas: row.ingresoTarjetas,
          ingresoTransferencias: row.ingresoTransferencias,
          licenciasMonto: row.licenciasMonto,
          otrosAbonos: row.otrosAbonos,
          roxairMonto: row.roxairMonto,
          testsMonto: row.testsMonto,
          vacunasMonto: row.vacunasMonto,
        },
      });
      updated += 1;
    }
  }

  return { inserted, skipped, updated };
}
