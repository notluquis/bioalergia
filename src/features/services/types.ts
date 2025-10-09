export type ServiceType = "BUSINESS" | "PERSONAL" | "SUPPLIER" | "TAX" | "UTILITY" | "LEASE" | "SOFTWARE" | "OTHER";

export type ServiceFrequency =
  | "WEEKLY"
  | "BIWEEKLY"
  | "MONTHLY"
  | "BIMONTHLY"
  | "QUARTERLY"
  | "SEMIANNUAL"
  | "ANNUAL"
  | "ONCE";

export type ServiceOwnership = "COMPANY" | "OWNER" | "MIXED" | "THIRD_PARTY";
export type ServiceObligationType = "SERVICE" | "DEBT" | "LOAN" | "OTHER";
export type ServiceRecurrenceType = "RECURRING" | "ONE_OFF";
export type ServiceAmountIndexation = "NONE" | "UF";
export type ServiceLateFeeMode = "NONE" | "FIXED" | "PERCENTAGE";
export type ServiceEmissionMode = "FIXED_DAY" | "DATE_RANGE" | "SPECIFIC_DATE";

export type ServiceSummary = {
  id: number;
  public_id: string;
  name: string;
  detail: string | null;
  category: string | null;
  service_type: ServiceType;
  ownership: ServiceOwnership;
  obligation_type: ServiceObligationType;
  recurrence_type: ServiceRecurrenceType;
  frequency: ServiceFrequency;
  default_amount: number;
  amount_indexation: ServiceAmountIndexation;
  counterpart_id: number | null;
  counterpart_account_id: number | null;
  account_reference: string | null;
  emission_day: number | null;
  emission_mode: ServiceEmissionMode;
  emission_start_day: number | null;
  emission_end_day: number | null;
  emission_exact_date: string | null;
  due_day: number | null;
  start_date: string;
  next_generation_months: number;
  late_fee_mode: ServiceLateFeeMode;
  late_fee_value: number | null;
  late_fee_grace_days: number | null;
  status: "ACTIVE" | "INACTIVE" | "ARCHIVED";
  notes: string | null;
  created_at: string;
  updated_at: string;
  total_expected: number;
  total_paid: number;
  pending_count: number;
  overdue_count: number;
  counterpart_name: string | null;
  counterpart_account_identifier: string | null;
  counterpart_account_bank_name: string | null;
  counterpart_account_type: string | null;
};

export type ServiceSchedule = {
  id: number;
  service_id: number;
  period_start: string;
  period_end: string;
  due_date: string;
  expected_amount: number;
  status: "PENDING" | "PAID" | "PARTIAL" | "SKIPPED";
  transaction_id: number | null;
  paid_amount: number | null;
  paid_date: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
  transaction?: {
    id: number;
    description: string | null;
    timestamp: string;
    amount: number | null;
  } | null;
  late_fee_amount: number;
  effective_amount: number;
  overdue_days: number;
};

export type ServiceListResponse = {
  status: "ok" | "error";
  services: ServiceSummary[];
};

export type ServiceDetailResponse = {
  status: "ok" | "error";
  service: ServiceSummary;
  schedules: ServiceSchedule[];
};

export type CreateServicePayload = {
  name: string;
  detail?: string | null;
  category?: string | null;
  serviceType: ServiceType;
  ownership?: ServiceOwnership;
  obligationType?: ServiceObligationType;
  recurrenceType?: ServiceRecurrenceType;
  frequency: ServiceFrequency;
  defaultAmount: number;
  amountIndexation?: ServiceAmountIndexation;
  counterpartId?: number | null;
  counterpartAccountId?: number | null;
  accountReference?: string | null;
  emissionMode?: ServiceEmissionMode;
  emissionDay?: number | null;
  emissionStartDay?: number | null;
  emissionEndDay?: number | null;
  emissionExactDate?: string | null;
  dueDay?: number | null;
  startDate: string;
  monthsToGenerate?: number;
  lateFeeMode?: ServiceLateFeeMode;
  lateFeeValue?: number | null;
  lateFeeGraceDays?: number | null;
  notes?: string | null;
};

export type RegenerateServicePayload = {
  months?: number;
  startDate?: string;
  defaultAmount?: number;
  dueDay?: number | null;
  frequency?: ServiceFrequency;
  emissionDay?: number | null;
};

export type ServicePaymentPayload = {
  transactionId: number;
  paidAmount: number;
  paidDate: string;
  note?: string | null;
};
