export interface CreateServicePayload {
  accountReference?: null | string;
  amountIndexation?: ServiceAmountIndexation;
  category?: null | string;
  counterpartAccountId?: null | number;
  counterpartId?: null | number;
  defaultAmount: number;
  detail?: null | string;
  dueDay?: null | number;
  emissionDay?: null | number;
  emissionEndDay?: null | number;
  emissionExactDate?: null | string;
  emissionMode?: ServiceEmissionMode;
  emissionStartDay?: null | number;
  frequency: ServiceFrequency;
  lateFeeGraceDays?: null | number;
  lateFeeMode?: ServiceLateFeeMode;
  lateFeeValue?: null | number;
  monthsToGenerate?: number;
  name: string;
  notes?: null | string;
  obligationType?: ServiceObligationType;
  ownership?: ServiceOwnership;
  recurrenceType?: ServiceRecurrenceType;
  serviceType: ServiceType;
  startDate: string;
}

export interface RegenerateServicePayload {
  defaultAmount?: number;
  dueDay?: null | number;
  emissionDay?: null | number;
  frequency?: ServiceFrequency;
  months?: number;
  startDate?: string;
}

export type ServiceAmountIndexation = "NONE" | "UF";
export interface ServiceDetailResponse {
  schedules: ServiceSchedule[];
  service: ServiceSummary;
  status: "error" | "ok";
}
export type ServiceEmissionMode = "DATE_RANGE" | "FIXED_DAY" | "SPECIFIC_DATE";
export type ServiceFrequency =
  | "ANNUAL"
  | "BIMONTHLY"
  | "BIWEEKLY"
  | "MONTHLY"
  | "ONCE"
  | "QUARTERLY"
  | "SEMIANNUAL"
  | "WEEKLY";
export type ServiceLateFeeMode = "FIXED" | "NONE" | "PERCENTAGE";
export interface ServiceListResponse {
  services: ServiceSummary[];
  status: "error" | "ok";
}

export type ServiceObligationType = "DEBT" | "LOAN" | "OTHER" | "SERVICE";

export type ServiceOwnership = "COMPANY" | "MIXED" | "OWNER" | "THIRD_PARTY";

export interface ServicePaymentPayload {
  note?: null | string;
  paidAmount: number;
  paidDate: string;
  transactionId: number;
}

export type ServiceRecurrenceType = "ONE_OFF" | "RECURRING";

export interface ServiceSchedule {
  created_at: string;
  due_date: string;
  effective_amount: number;
  expected_amount: number;
  id: number;
  late_fee_amount: number;
  note: null | string;
  overdue_days: number;
  paid_amount: null | number;
  paid_date: null | string;
  period_end: string;
  period_start: string;
  service_id: number;
  status: "PAID" | "PARTIAL" | "PENDING" | "SKIPPED";
  transaction?: null | {
    amount: null | number;
    description: null | string;
    id: number;
    timestamp: string;
  };
  transaction_id: null | number;
  updated_at: string;
}

export interface ServicesFilterState {
  search: string;
  statuses: Set<"ACTIVE" | "ARCHIVED" | "INACTIVE">;
  types: Set<ServiceType>;
}

export interface ServiceSummary {
  account_reference: null | string;
  amount_indexation: ServiceAmountIndexation;
  category: null | string;
  counterpart_account_bank_name: null | string;
  counterpart_account_id: null | number;
  counterpart_account_identifier: null | string;
  counterpart_account_type: null | string;
  counterpart_id: null | number;
  counterpart_name: null | string;
  created_at: string;
  default_amount: number;
  detail: null | string;
  due_day: null | number;
  emission_day: null | number;
  emission_end_day: null | number;
  emission_exact_date: null | string;
  emission_mode: ServiceEmissionMode;
  emission_start_day: null | number;
  frequency: ServiceFrequency;
  id: number;
  late_fee_grace_days: null | number;
  late_fee_mode: ServiceLateFeeMode;
  late_fee_value: null | number;
  name: string;
  next_generation_months: number;
  notes: null | string;
  obligation_type: ServiceObligationType;
  overdue_count: number;
  ownership: ServiceOwnership;
  pending_count: number;
  public_id: string;
  recurrence_type: ServiceRecurrenceType;
  service_type: ServiceType;
  start_date: string;
  status: "ACTIVE" | "ARCHIVED" | "INACTIVE";
  total_expected: number;
  total_paid: number;
  updated_at: string;
}

export interface ServiceTemplate {
  category?: string;
  description: string;
  id: string;
  name: string;
  payload: Partial<CreateServicePayload>;
}

export type ServiceType = "BUSINESS" | "LEASE" | "OTHER" | "PERSONAL" | "SOFTWARE" | "SUPPLIER" | "TAX" | "UTILITY";

export interface SummaryTotals {
  activeCount: number;
  overdueCount: number;
  pendingCount: number;
  totalExpected: number;
  totalPaid: number;
}
