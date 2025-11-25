import { Prisma } from "../../generated/prisma/client.js";
import { normalizeTimestamp } from "./time.js";

// --- Types ---

export type CounterpartWithAccounts = Prisma.CounterpartGetPayload<{
  include: { accounts: true; person: true };
}>;

export type CounterpartAccountType = Prisma.CounterpartAccountGetPayload<{}>;

export type ServiceWithCounterpart = Prisma.ServiceGetPayload<{
  include: { counterpart: { include: { person: true } } };
}>;

export type EnrichedTransaction = Prisma.TransactionGetPayload<{
  include: { person: true };
}>;

// --- Mappers ---

export function mapCounterpart(c: CounterpartWithAccounts) {
  return {
    id: c.id,
    rut: c.person.rut,
    name: c.person.names,
    person_type: c.person.personType,
    category: c.category,
    email: c.person.email,
    notes: c.notes,
    created_at: c.createdAt,
    updated_at: c.updatedAt,
  };
}

export function mapCounterpartAccount(a: CounterpartAccountType) {
  return {
    id: a.id,
    counterpart_id: a.counterpartId,
    bank_name: a.bankName,
    account_type: a.accountType,
    account_number: a.accountNumber,
  };
}

export function mapService(s: ServiceWithCounterpart) {
  return {
    id: s.id,
    name: s.name,
    category: s.counterpart?.category,
    service_type: s.type,
    default_amount: s.defaultAmount,
    counterpart_id: s.counterpartId,
    frequency: s.frequency,
    status: s.status,
    created_at: s.createdAt,
    updated_at: s.updatedAt,
    counterpart_name: s.counterpart?.person.names,
  };
}

export function mapTransaction(row: EnrichedTransaction) {
  return {
    id: Number(row.id),
    timestamp: normalizeTimestamp(row.timestamp, null),
    description: row.description,
    origin: row.origin,
    destination: row.destination,
    direction: row.direction as "IN" | "OUT" | "NEUTRO",
    amount: row.amount != null ? Number(row.amount) : null,
    created_at: row.createdAt.toISOString(),
    person_name: row.person?.names,
    person_rut: row.person?.rut,
  };
}
