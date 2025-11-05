import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { getPool } from "../db.js";
import { normalizeRut } from "../lib/rut.js";

export type EmployeeRecord = {
  id: number;
  full_name: string;
  role: string;
  email: string | null;
  rut: string | null;
  bank_name: string | null;
  bank_account_type: string | null;
  bank_account_number: string | null;
  salary_type: "hourly" | "fixed";
  hourly_rate: number;
  fixed_salary: number | null;
  overtime_rate: number | null;
  retention_rate: number;
  status: "ACTIVE" | "INACTIVE";
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

const EMPLOYEE_FIELDS = `id, full_name, role, email, rut, bank_name, bank_account_type, bank_account_number, salary_type, hourly_rate, fixed_salary, overtime_rate, retention_rate, status, metadata, created_at, updated_at`;

export async function listEmployees(options: { includeInactive?: boolean } = {}) {
  const pool = getPool();
  const whereClause = options.includeInactive ? "" : "WHERE status = 'ACTIVE'";
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT ${EMPLOYEE_FIELDS}
     FROM employees
     ${whereClause}
     ORDER BY full_name ASC`
  );

  return rows.map(mapEmployeeRow);
}

export async function getEmployeeById(id: number) {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT ${EMPLOYEE_FIELDS}
     FROM employees
     WHERE id = ?
     LIMIT 1`,
    [id]
  );
  const row = rows[0];
  return row ? mapEmployeeRow(row) : null;
}

export async function findEmployeeByEmail(email: string) {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT ${EMPLOYEE_FIELDS}
       FROM employees
      WHERE LOWER(email) = LOWER(?)
      LIMIT 1`,
    [email]
  );
  const row = rows[0];
  return row ? mapEmployeeRow(row) : null;
}

export async function createEmployee(data: {
  full_name: string;
  role: string;
  email?: string | null;
  rut?: string | null;
  bank_name?: string | null;
  bank_account_type?: string | null;
  bank_account_number?: string | null;
  salary_type: "hourly" | "fixed";
  hourly_rate?: number;
  fixed_salary?: number | null;
  overtime_rate?: number | null;
  retention_rate: number;
  metadata?: Record<string, unknown> | null;
}) {
  const pool = getPool();
  const normalizedRut = data.rut ? normalizeRut(data.rut) : null;
  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO employees
      (full_name, role, email, rut, bank_name, bank_account_type, bank_account_number, salary_type, hourly_rate, fixed_salary, overtime_rate, retention_rate, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.full_name,
      data.role,
      data.email ?? null,
      normalizedRut,
      data.bank_name ?? null,
      data.bank_account_type ?? null,
      data.bank_account_number ?? null,
      data.salary_type,
      data.hourly_rate ?? null,
      data.fixed_salary ?? null,
      data.overtime_rate ?? null,
      data.retention_rate,
      data.metadata ? JSON.stringify(data.metadata) : null,
    ]
  );

  return getEmployeeById(Number(result.insertId));
}

export async function updateEmployee(
  id: number,
  data: {
    full_name?: string;
    role?: string;
    email?: string | null;
    rut?: string | null;
    bank_name?: string | null;
    bank_account_type?: string | null;
    bank_account_number?: string | null;
    salary_type?: "hourly" | "fixed";
    hourly_rate?: number;
    fixed_salary?: number | null;
    overtime_rate?: number | null;
    retention_rate?: number;
    status?: "ACTIVE" | "INACTIVE";
    metadata?: Record<string, unknown> | null;
  }
) {
  const pool = getPool();
  const fields: string[] = [];
  const params: Array<string | number | null> = [];

  if (data.full_name != null) {
    fields.push("full_name = ?");
    params.push(data.full_name);
  }
  if (data.role != null) {
    fields.push("role = ?");
    params.push(data.role);
  }
  if (data.email !== undefined) {
    fields.push("email = ?");
    params.push(data.email ?? null);
  }
  if (data.rut !== undefined) {
    fields.push("rut = ?");
    params.push(data.rut ? normalizeRut(data.rut) : null);
  }
  if (data.bank_name !== undefined) {
    fields.push("bank_name = ?");
    params.push(data.bank_name ?? null);
  }
  if (data.bank_account_type !== undefined) {
    fields.push("bank_account_type = ?");
    params.push(data.bank_account_type ?? null);
  }
  if (data.bank_account_number !== undefined) {
    fields.push("bank_account_number = ?");
    params.push(data.bank_account_number ?? null);
  }
  if (data.salary_type != null) {
    fields.push("salary_type = ?");
    params.push(data.salary_type);
  }
  if (data.hourly_rate != null) {
    fields.push("hourly_rate = ?");
    params.push(data.hourly_rate);
  }
  if (data.fixed_salary !== undefined) {
    fields.push("fixed_salary = ?");
    params.push(data.fixed_salary ?? null);
  }
  if (data.overtime_rate !== undefined) {
    fields.push("overtime_rate = ?");
    params.push(data.overtime_rate ?? null);
  }
  if (data.retention_rate != null) {
    fields.push("retention_rate = ?");
    params.push(data.retention_rate);
  }
  if (data.status != null) {
    fields.push("status = ?");
    params.push(data.status);
  }
  if (data.metadata !== undefined) {
    fields.push("metadata = ?");
    params.push(data.metadata ? JSON.stringify(data.metadata) : null);
  }

  if (!fields.length) return getEmployeeById(id);

  params.push(id);
  await pool.query<ResultSetHeader>(
    `UPDATE employees
     SET ${fields.join(", ")}
     WHERE id = ?`,
    params
  );

  return getEmployeeById(id);
}

export async function deactivateEmployee(id: number) {
  await updateEmployee(id, { status: "INACTIVE" });
}

function mapEmployeeRow(row: RowDataPacket): EmployeeRecord {
  return {
    id: Number(row.id),
    full_name: String(row.full_name),
    role: String(row.role),
    email: row.email ? String(row.email) : null,
    rut: row.rut ? String(row.rut) : null,
    bank_name: row.bank_name ? String(row.bank_name) : null,
    bank_account_type: row.bank_account_type ? String(row.bank_account_type) : null,
    bank_account_number: row.bank_account_number ? String(row.bank_account_number) : null,
    salary_type: row.salary_type === "fixed" ? "fixed" : "hourly",
    hourly_rate: Number(row.hourly_rate ?? 0),
    fixed_salary: row.fixed_salary != null ? Number(row.fixed_salary) : null,
    overtime_rate: row.overtime_rate != null ? Number(row.overtime_rate) : null,
    retention_rate: Number(row.retention_rate ?? 0),
    status: (row.status as EmployeeRecord["status"]) ?? "ACTIVE",
    metadata: typeof row.metadata === "string" ? safeParseJson(row.metadata) : (row.metadata as Record<string, unknown> | null) ?? null,
    created_at: toIsoString(row.created_at),
    updated_at: toIsoString(row.updated_at),
  };
}

function safeParseJson(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function toIsoString(value: Date | string | null) {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "string") {
    return value.includes("T") ? value : `${value}Z`;
  }
  return "";
}
