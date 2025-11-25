import { Prisma } from "../../generated/prisma/client.js";
import { normalizeTimestamp, normalizeTimestampString } from "./time.js";

// --- Types ---

export type CounterpartWithAccounts = Prisma.CounterpartGetPayload<{
  include: { accounts: true };
}>;

export type CounterpartAccountType = Prisma.CounterpartAccountGetPayload<{}>;

export type ServiceWithSchedules = Prisma.ServiceGetPayload<{ include: { schedules: true } }> & {
  counterpartName?: string | null;
  counterpartAccountIdentifier?: string | null;
  counterpartAccountBankName?: string | null;
  counterpartAccountType?: string | null;
  total_expected?: number;
  total_paid?: number;
  pending_count?: number;
  overdue_count?: number;
};

// --- Mappers ---

export function mapCounterpart(c: CounterpartWithAccounts) {
  return {
    id: c.id,
    rut: c.rut,
    name: c.name,
    person_type: c.personType,
    category: c.category,
    email: c.email,
    employee_id: c.employeeId,
    notes: c.notes,
    created_at: c.createdAt,
    updated_at: c.updatedAt,
  };
}

export function mapCounterpartAccount(a: CounterpartAccountType) {
  return {
    id: a.id,
    counterpart_id: a.counterpartId,
    account_identifier: a.accountIdentifier,
    bank_name: a.bankName,
    account_type: a.accountType,
    holder: a.holder,
    concept: a.concept,
    metadata: a.metadata,
    created_at: a.createdAt,
    updated_at: a.updatedAt,
  };
}

export function mapService(s: ServiceWithSchedules) {
  return {
    id: s.id,
    public_id: s.publicId,
    name: s.name,
    detail: s.detail,
    category: s.category,
    service_type: s.serviceType,
    ownership: s.ownership,
    default_amount: s.defaultAmount,
    counterpart_id: s.counterpartId,
    counterpart_account_id: s.counterpartAccountId,
    frequency: s.frequency,
    recurrence_type: s.recurrenceType,
    due_day: s.dueDay,
    emission_day: s.emissionDay,
    start_date: s.startDate,
    next_generation_months: s.nextGenerationMonths,
    late_fee_mode: s.lateFeeMode,
    late_fee_value: s.lateFeeValue,
    late_fee_grace_days: s.lateFeeGraceDays,
    notes: s.notes,
    status: s.status,
    created_at: s.createdAt,
    updated_at: s.updatedAt,
    // Extra fields from summary/detail
    counterpart_name: s.counterpartName,
    counterpart_account_identifier: s.counterpartAccountIdentifier,
    counterpart_account_bank_name: s.counterpartAccountBankName,
    counterpart_account_type: s.counterpartAccountType,
    total_expected: s.total_expected,
    total_paid: s.total_paid,
    pending_count: s.pending_count,
    overdue_count: s.overdue_count,
  };
}

import type { EnrichedTransaction } from "../services/transactions.js";

export function mapTransaction(row: EnrichedTransaction) {
  const payout = row.payout
    ? {
        withdrawId: String(row.payout.withdrawId),
        dateCreated:
          normalizeTimestampString(row.payout.dateCreated ? row.payout.dateCreated.toISOString() : null) || null,
        status: (row.payout.status as string) ?? null,
        statusDetail: (row.payout.statusDetail as string) ?? null,
        amount: row.payout.amount != null ? Number(row.payout.amount) : null,
        fee: row.payout.fee != null ? Number(row.payout.fee) : null,
        payoutDesc: (row.payout.payoutDesc as string) ?? null,
        bankAccountHolder: (row.payout.bankAccountHolder as string) ?? null,
        bankName: (row.payout.bankName as string) ?? null,
        bankAccountType: (row.payout.bankAccountType as string) ?? null,
        bankAccountNumber: (row.payout.bankAccountNumber as string) ?? null,
        bankBranch: (row.payout.bankBranch as string) ?? null,
        identificationType: (row.payout.identificationType as string) ?? null,
        identificationNumber: (row.payout.identificationNumber as string) ?? null,
      }
    : null;

  const originalDestination = (row.destination as string) ?? null;
  const destination =
    (row.direction as string) === "OUT" && payout?.bankAccountHolder
      ? `${payout.bankAccountHolder}${payout.bankName ? ` · ${payout.bankName}` : ""}`
      : originalDestination;

  const loanSchedule = row.loanSchedule
    ? {
        id: Number(row.loanSchedule.id),
        installmentNumber: Number(row.loanSchedule.installmentNumber ?? 0),
        status: (row.loanSchedule.status as string) ?? "PENDING",
        dueDate: row.loanSchedule.dueDate ? row.loanSchedule.dueDate.toISOString().slice(0, 10) : null,
        expectedAmount: row.loanSchedule.expectedAmount != null ? Number(row.loanSchedule.expectedAmount) : null,
        loanTitle: row.loanSchedule.loan?.title != null ? String(row.loanSchedule.loan.title) : null,
        loanPublicId: row.loanSchedule.loan?.publicId != null ? String(row.loanSchedule.loan.publicId) : null,
      }
    : null;

  const serviceSchedule = row.serviceSchedule
    ? {
        id: Number(row.serviceSchedule.id),
        status: (row.serviceSchedule.status as string) ?? "PENDING",
        dueDate: row.serviceSchedule.dueDate ? row.serviceSchedule.dueDate.toISOString().slice(0, 10) : null,
        expectedAmount: row.serviceSchedule.expectedAmount != null ? Number(row.serviceSchedule.expectedAmount) : null,
        serviceName: row.serviceSchedule.service?.name != null ? String(row.serviceSchedule.service.name) : null,
        servicePublicId:
          row.serviceSchedule.service?.publicId != null ? String(row.serviceSchedule.service.publicId) : null,
        periodStart: row.serviceSchedule.periodStart
          ? row.serviceSchedule.periodStart.toISOString().slice(0, 10)
          : null,
      }
    : null;

  return {
    id: Number(row.id),
    timestamp: normalizeTimestamp(row.timestamp, row.timestampRaw),
    timestamp_raw: (row.timestampRaw as string) ?? null,
    description: (row.description as string) ?? payout?.payoutDesc ?? null,
    origin: (row.origin as string) ?? null,
    destination,
    source_id: (row.sourceId as string) ?? null,
    direction: row.direction as "IN" | "OUT" | "NEUTRO",
    amount: row.amount != null ? Number(row.amount) : null,
    created_at: row.createdAt.toISOString(),
    payout,
    loanSchedule,
    serviceSchedule,
  };
}
