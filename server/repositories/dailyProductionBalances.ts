import type { ResultSetHeader, RowDataPacket } from "mysql2";
import dayjs from "dayjs";
import { getPool } from "../db.js";

export type ProductionBalanceStatus = "DRAFT" | "FINAL";

export type ProductionBalanceRecord = {
  id: number;
  balanceDate: string;
  ingresoTarjetas: number;
  ingresoTransferencias: number;
  ingresoEfectivo: number;
  subtotalIngresos: number;
  gastosDiarios: number;
  totalIngresos: number;
  consultasCount: number;
  controlesCount: number;
  testsCount: number;
  vacunasCount: number;
  licenciasCount: number;
  roxairCount: number;
  otrosAbonos: number;
  total: number;
  comentarios: string | null;
  status: ProductionBalanceStatus;
  createdBy: number;
  updatedBy: number | null;
  createdByEmail: string | null;
  updatedByEmail: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProductionBalanceHistoryEntry = {
  id: number;
  balanceId: number;
  snapshot: ProductionBalanceRecord | null;
  changeReason: string | null;
  changedBy: number | null;
  changedByEmail: string | null;
  createdAt: string;
};

export type ProductionBalancePayload = {
  balanceDate: string;
  ingresoTarjetas: number;
  ingresoTransferencias: number;
  ingresoEfectivo: number;
  gastosDiarios: number;
  otrosAbonos: number;
  consultasCount: number;
  controlesCount: number;
  testsCount: number;
  vacunasCount: number;
  licenciasCount: number;
  roxairCount: number;
  comentarios: string | null;
  status: ProductionBalanceStatus;
  changeReason?: string | null;
};

export type ListProductionBalanceOptions = {
  from: string;
  to: string;
};

const asInt = (value: unknown, fallback = 0): number => {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.round(num);
};

function computeTotals(payload: ProductionBalancePayload) {
  const subtotalIngresos =
    asInt(payload.ingresoTarjetas) + asInt(payload.ingresoTransferencias) + asInt(payload.ingresoEfectivo);
  const totalIngresos = subtotalIngresos - asInt(payload.gastosDiarios);
  const total = totalIngresos + asInt(payload.otrosAbonos);

  return {
    subtotalIngresos,
    totalIngresos,
    total,
  };
}

function mapBalanceRow(row: RowDataPacket): ProductionBalanceRecord {
  return {
    id: Number(row.id),
    balanceDate: dayjs(row.balance_date as string | Date).format("YYYY-MM-DD"),
    ingresoTarjetas: Number(row.ingreso_tarjetas ?? 0),
    ingresoTransferencias: Number(row.ingreso_transferencias ?? 0),
    ingresoEfectivo: Number(row.ingreso_efectivo ?? 0),
    subtotalIngresos: Number(row.subtotal_ingresos ?? 0),
    gastosDiarios: Number(row.gastos_diarios ?? 0),
    totalIngresos: Number(row.total_ingresos ?? 0),
    consultasCount: Number(row.consultas_count ?? 0),
    controlesCount: Number(row.controles_count ?? 0),
    testsCount: Number(row.tests_count ?? 0),
    vacunasCount: Number(row.vacunas_count ?? 0),
    licenciasCount: Number(row.licencias_count ?? 0),
    roxairCount: Number(row.roxair_count ?? 0),
    otrosAbonos: Number(row.otros_abonos ?? 0),
    total: Number(row.total ?? 0),
    comentarios: row.comentarios ? String(row.comentarios) : null,
    status: (row.status as ProductionBalanceStatus) ?? "DRAFT",
    createdBy: Number(row.created_by),
    updatedBy: row.updated_by != null ? Number(row.updated_by) : null,
    createdByEmail: row.created_by_email ? String(row.created_by_email) : null,
    updatedByEmail: row.updated_by_email ? String(row.updated_by_email) : null,
    createdAt: dayjs(row.created_at as string | Date).toISOString(),
    updatedAt: dayjs(row.updated_at as string | Date).toISOString(),
  };
}

export async function listProductionBalances(
  options: ListProductionBalanceOptions
): Promise<ProductionBalanceRecord[]> {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT b.*, cu.email AS created_by_email, uu.email AS updated_by_email
     FROM mp_daily_production_balances b
     LEFT JOIN users cu ON cu.id = b.created_by
     LEFT JOIN users uu ON uu.id = b.updated_by
     WHERE b.balance_date >= ? AND b.balance_date <= ?
     ORDER BY b.balance_date DESC, b.id DESC
     LIMIT 500`,
    [options.from, options.to]
  );

  return rows.map(mapBalanceRow);
}

export async function getProductionBalanceById(id: number): Promise<ProductionBalanceRecord | null> {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT b.*, cu.email AS created_by_email, uu.email AS updated_by_email
     FROM mp_daily_production_balances b
     LEFT JOIN users cu ON cu.id = b.created_by
     LEFT JOIN users uu ON uu.id = b.updated_by
     WHERE b.id = ?
     LIMIT 1`,
    [id]
  );
  const row = rows[0];
  return row ? mapBalanceRow(row) : null;
}

export async function createProductionBalance(
  payload: ProductionBalancePayload,
  userId: number
): Promise<ProductionBalanceRecord> {
  const pool = getPool();
  const totals = computeTotals(payload);

  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO mp_daily_production_balances
      (balance_date, ingreso_tarjetas, ingreso_transferencias, ingreso_efectivo, subtotal_ingresos, gastos_diarios, total_ingresos, consultas_count, controles_count, tests_count, vacunas_count, licencias_count, roxair_count, otros_abonos, total, comentarios, status, created_by, updated_by)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      payload.balanceDate,
      asInt(payload.ingresoTarjetas),
      asInt(payload.ingresoTransferencias),
      asInt(payload.ingresoEfectivo),
      totals.subtotalIngresos,
      asInt(payload.gastosDiarios),
      totals.totalIngresos,
      asInt(payload.consultasCount),
      asInt(payload.controlesCount),
      asInt(payload.testsCount),
      asInt(payload.vacunasCount),
      asInt(payload.licenciasCount),
      asInt(payload.roxairCount),
      asInt(payload.otrosAbonos),
      totals.total,
      payload.comentarios,
      payload.status,
      userId,
      userId,
    ]
  );

  const insertedId = result.insertId ? Number(result.insertId) : null;
  if (!insertedId) {
    throw new Error("No se pudo crear el balance diario de prestaciones");
  }
  const created = await getProductionBalanceById(insertedId);
  if (!created) throw new Error("No se pudo recuperar el balance recién creado");
  return created;
}

export async function updateProductionBalance(
  id: number,
  payload: ProductionBalancePayload,
  userId: number
): Promise<ProductionBalanceRecord> {
  const existing = await getProductionBalanceById(id);
  if (!existing) {
    throw new Error("Balance no encontrado");
  }

  const pool = getPool();
  const totals = computeTotals(payload);

  await pool.query(
    `INSERT INTO mp_daily_production_balance_history (balance_id, snapshot, change_reason, changed_by)
     VALUES (?, ?, ?, ?)`,
    [id, JSON.stringify(existing), payload.changeReason ?? null, userId]
  );

  await pool.query(
    `UPDATE mp_daily_production_balances
     SET
       balance_date = ?,
       ingreso_tarjetas = ?,
       ingreso_transferencias = ?,
       ingreso_efectivo = ?,
       subtotal_ingresos = ?,
       gastos_diarios = ?,
       total_ingresos = ?,
       consultas_count = ?,
       controles_count = ?,
       tests_count = ?,
       vacunas_count = ?,
       licencias_count = ?,
       roxair_count = ?,
       otros_abonos = ?,
       total = ?,
       comentarios = ?,
       status = ?,
       updated_by = ?,
       updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [
      payload.balanceDate,
      asInt(payload.ingresoTarjetas),
      asInt(payload.ingresoTransferencias),
      asInt(payload.ingresoEfectivo),
      totals.subtotalIngresos,
      asInt(payload.gastosDiarios),
      totals.totalIngresos,
      asInt(payload.consultasCount),
      asInt(payload.controlesCount),
      asInt(payload.testsCount),
      asInt(payload.vacunasCount),
      asInt(payload.licenciasCount),
      asInt(payload.roxairCount),
      asInt(payload.otrosAbonos),
      totals.total,
      payload.comentarios,
      payload.status,
      userId,
      id,
    ]
  );

  const updated = await getProductionBalanceById(id);
  if (!updated) throw new Error("No se pudo recuperar el balance actualizado");
  return updated;
}

export async function listProductionBalanceHistory(balanceId: number): Promise<ProductionBalanceHistoryEntry[]> {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT h.id, h.balance_id, h.snapshot, h.change_reason, h.changed_by, h.created_at, u.email AS changed_by_email
     FROM mp_daily_production_balance_history h
     LEFT JOIN users u ON u.id = h.changed_by
     WHERE h.balance_id = ?
     ORDER BY h.created_at DESC
     LIMIT 50`,
    [balanceId]
  );

  return rows.map((row) => ({
    id: Number(row.id),
    balanceId: Number(row.balance_id),
    snapshot:
      (typeof row.snapshot === "string"
        ? (JSON.parse(row.snapshot) as ProductionBalanceRecord)
        : (row.snapshot as ProductionBalanceRecord)) ?? null,
    changeReason: row.change_reason ? String(row.change_reason) : null,
    changedBy: row.changed_by != null ? Number(row.changed_by) : null,
    changedByEmail: row.changed_by_email ? String(row.changed_by_email) : null,
    createdAt: dayjs(row.created_at as string | Date).toISOString(),
  }));
}

export async function getLastProductionBalanceDate(): Promise<string | null> {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT balance_date
     FROM mp_daily_production_balances
     ORDER BY balance_date DESC
     LIMIT 1`
  );
  const date = rows[0]?.balance_date as string | Date | undefined;
  return date ? dayjs(date).format("YYYY-MM-DD") : null;
}

export async function hasBalanceForDate(date: string): Promise<boolean> {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(1) as total
     FROM mp_daily_production_balances
     WHERE balance_date = ?`,
    [date]
  );
  return Number(rows[0]?.total ?? 0) > 0;
}
