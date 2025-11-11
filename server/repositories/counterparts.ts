import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { getPool } from "../db.js";
import { normalizeRut, validateRut } from "../lib/rut.js";
import { createEmployee, findEmployeeByEmail } from "./employees.js";

export type CounterpartPersonType = "PERSON" | "COMPANY" | "OTHER";
export type CounterpartCategory =
  | "SUPPLIER"
  | "PATIENT"
  | "EMPLOYEE"
  | "PARTNER"
  | "RELATED"
  | "OTHER"
  | "CLIENT"
  | "LENDER"
  | "OCCASIONAL";

export type CounterpartAccountMetadata = {
  bankAccountNumber?: string | null;
  withdrawId?: string | null;
};

export type CounterpartRecord = {
  id: number;
  rut: string | null;
  name: string;
  personType: CounterpartPersonType;
  category: CounterpartCategory;
  employeeId: number | null;
  email: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type CounterpartAccountRecord = {
  id: number;
  counterpart_id: number;
  account_identifier: string;
  bank_name: string | null;
  account_type: string | null;
  holder: string | null;
  concept: string | null;
  metadata: CounterpartAccountMetadata | null;
  created_at: string;
  updated_at: string;
};

const COUNTERPART_FIELDS = `id, rut, name, person_type, category, employee_id, email, notes, created_at, updated_at`;

export async function listCounterparts(): Promise<CounterpartRecord[]> {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT ${COUNTERPART_FIELDS}
     FROM mp_counterparts
     ORDER BY name ASC`
  );
  return rows.map(mapCounterpart);
}

export async function getCounterpartById(id: number) {
  const pool = getPool();
  const [[counterpartRow]] = await pool.query<RowDataPacket[]>(
    `SELECT ${COUNTERPART_FIELDS}
     FROM mp_counterparts
     WHERE id = ?
     LIMIT 1`,
    [id]
  );
  if (!counterpartRow) return null;

  const [accountRows] = await pool.query<RowDataPacket[]>(
    `SELECT a.id,
            a.counterpart_id,
            a.account_identifier,
            a.bank_name,
            a.account_type,
            a.holder,
            a.concept,
            a.metadata,
            a.created_at,
            a.updated_at,
            MAX(mw.bank_account_number) AS mw_bank_account_number,
            MAX(mw.bank_name) AS mw_bank_name,
            MAX(mw.bank_account_holder) AS mw_bank_account_holder,
            MAX(mw.bank_account_type) AS mw_bank_account_type
     FROM mp_counterpart_accounts a
     LEFT JOIN mp_withdrawals mw ON mw.withdraw_id = a.account_identifier
     WHERE a.counterpart_id = ?
     GROUP BY a.id
     ORDER BY a.created_at ASC`,
    [id]
  );

  return {
    counterpart: mapCounterpart(counterpartRow),
    accounts: accountRows.map(mapCounterpartAccount),
  };
}

export async function createCounterpart(payload: {
  rut?: string | null;
  name: string;
  personType: CounterpartPersonType;
  category?: CounterpartCategory;
  employeeId?: number | null;
  employeeEmail?: string | null;
  email?: string | null;
  notes?: string | null;
}) {
  const pool = getPool();
  const rutNormalized = payload.rut ? normalizeRut(payload.rut) : null;

  if (payload.rut && (!rutNormalized || !validateRut(rutNormalized))) {
    throw new Error("RUT inválido");
  }

  let employeeId = payload.employeeId ?? null;
  if (payload.category === "EMPLOYEE") {
    employeeId = await ensureEmployeeForCounterpart(payload.name, payload.email ?? payload.employeeEmail ?? null);
  }

  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO mp_counterparts (rut, name, person_type, category, employee_id, email, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      rutNormalized,
      payload.name,
      payload.personType,
      payload.category ?? "SUPPLIER",
      employeeId,
      payload.email?.trim() || null,
      payload.notes ?? null,
    ]
  );

  const id = Number(result.insertId);

  if (rutNormalized) {
    await attachAccountsByRut(id, rutNormalized);
  }

  return id;
}

export async function updateCounterpart(
  id: number,
  payload: {
    rut?: string | null;
    name?: string;
    personType?: CounterpartPersonType;
    category?: CounterpartCategory;
    employeeId?: number | null;
    employeeEmail?: string | null;
    email?: string | null;
    notes?: string | null;
  }
) {
  const fields: string[] = [];
  const params: Array<string | number | null> = [];
  let normalizedRut: string | null | undefined;

  if (payload.rut !== undefined) {
    normalizedRut = payload.rut ? normalizeRut(payload.rut) : null;
    if (payload.rut && (!normalizedRut || !validateRut(normalizedRut))) {
      throw new Error("RUT inválido");
    }
    fields.push("rut = ?");
    params.push(normalizedRut);
  }

  if (payload.name !== undefined) {
    fields.push("name = ?");
    params.push(payload.name);
  }

  if (payload.personType !== undefined) {
    fields.push("person_type = ?");
    params.push(payload.personType);
  }

  let employeeId = payload.employeeId ?? null;
  if (payload.category !== undefined) {
    fields.push("category = ?");
    params.push(payload.category);
  }

  if (payload.category === "EMPLOYEE") {
    const current = await getCounterpartById(id);
    employeeId = await ensureEmployeeForCounterpart(
      payload.name ?? current?.counterpart.name ?? "",
      payload.email ?? payload.employeeEmail ?? null
    );
  }

  if (payload.category !== undefined || payload.employeeId !== undefined || payload.employeeEmail !== undefined) {
    fields.push("employee_id = ?");
    params.push(employeeId);
  }

  if (payload.email !== undefined) {
    fields.push("email = ?");
    params.push(payload.email?.trim() || null);
  }

  if (payload.notes !== undefined) {
    fields.push("notes = ?");
    params.push(payload.notes ?? null);
  }

  if (!fields.length) return;

  params.push(id);
  const pool = getPool();
  await pool.query(`UPDATE mp_counterparts SET ${fields.join(", ")} WHERE id = ? LIMIT 1`, params);

  if (normalizedRut) {
    await attachAccountsByRut(id, normalizedRut);
  }
}

// Helper functions

async function ensureEmployeeForCounterpart(name: string, email?: string | null) {
  const trimmedEmail = email?.trim();

  if (!trimmedEmail) {
    const employee = await createEmployee({
      full_name: name,
      role: "GENERATED",
      email: null,
      salary_type: "hourly",
      hourly_rate: 0,
      retention_rate: 0,
      metadata: { source: "counterpart" },
    });
    return employee?.id ?? null;
  }

  const existing = await findEmployeeByEmail(trimmedEmail);
  if (existing) {
    return existing.id;
  }

  const employee = await createEmployee({
    full_name: name,
    role: "GENERATED",
    email: trimmedEmail,
    salary_type: "hourly",
    hourly_rate: 0,
    retention_rate: 0,
    metadata: { source: "counterpart" },
  });
  return employee?.id ?? null;
}

async function attachAccountsByRut(counterpartId: number, rut: string) {
  const normalized = normalizeRut(rut);
  if (!normalized) return;

  const numericRut = normalized.replace(/[^0-9K]/gi, "");
  const pool = getPool();

  await pool.query(
    `UPDATE mp_counterpart_accounts
     SET counterpart_id = ?
     WHERE account_identifier LIKE ?
       AND (counterpart_id IS NULL OR counterpart_id = 0)`,
    [counterpartId, `%${numericRut}%`]
  );
}

function mapCounterpart(row: RowDataPacket): CounterpartRecord {
  return {
    id: Number(row.id),
    rut: row.rut ? String(row.rut) : null,
    name: String(row.name),
    personType: (row.person_type as CounterpartPersonType) ?? "OTHER",
    category: (row.category as CounterpartCategory) ?? "SUPPLIER",
    employeeId: row.employee_id != null ? Number(row.employee_id) : null,
    email: row.email ? String(row.email) : null,
    notes: row.notes ? String(row.notes) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function mapCounterpartAccount(row: RowDataPacket): CounterpartAccountRecord {
  let metadata: CounterpartAccountMetadata | null = null;
  if (row.metadata) {
    try {
      const parsed = JSON.parse(String(row.metadata));
      metadata = parsed && typeof parsed === "object" ? parsed : null;
    } catch {
      metadata = null;
    }
  }

  const withdrawBankAccountNumber = row.mw_bank_account_number ? String(row.mw_bank_account_number) : null;
  const withdrawBankName = row.mw_bank_name ? String(row.mw_bank_name) : null;
  const withdrawHolder = row.mw_bank_account_holder ? String(row.mw_bank_account_holder) : null;
  const withdrawAccountType = row.mw_bank_account_type ? String(row.mw_bank_account_type) : null;

  return {
    id: Number(row.id),
    counterpart_id: Number(row.counterpart_id),
    account_identifier: String(row.account_identifier),
    bank_name: withdrawBankName || (row.bank_name ? String(row.bank_name) : null),
    account_type: withdrawAccountType || (row.account_type ? String(row.account_type) : null),
    holder: withdrawHolder || (row.holder ? String(row.holder) : null),
    concept: row.concept ? String(row.concept) : null,
    metadata: metadata ?? {
      bankAccountNumber: withdrawBankAccountNumber,
      withdrawId: row.account_identifier ? String(row.account_identifier) : null,
    },
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}
