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
  emissionExactDate?: null | Date;
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
  startDate: Date;
}

export interface RegenerateServicePayload {
  defaultAmount?: number;
  dueDay?: null | number;
  emissionDay?: null | number;
  frequency?: ServiceFrequency;
  months?: number;
  startDate?: Date;
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
  paidDate: Date;
  transactionId: number;
}

export interface ServiceScheduleEditPayload {
  dueDate?: Date;
  expectedAmount?: number;
  note?: null | string;
}

export interface ServiceScheduleSkipPayload {
  reason: string;
}

export type ServiceRecurrenceType = "ONE_OFF" | "RECURRING";

export interface ServiceSchedule {
  createdAt: Date;
  dueDate: Date;
  effectiveAmount: number;
  expectedAmount: number;
  id: number;
  lateFeeAmount: number;
  note: null | string;
  overdueDays: number;
  paidAmount: null | number;
  paidDate: null | Date;
  periodEnd: Date;
  periodStart: Date;
  serviceId: number;
  status: "PAID" | "PARTIAL" | "PENDING" | "SKIPPED";
  transaction?: null | {
    amount: null | number;
    description: null | string;
    id: number;
    timestamp: Date;
  };
  transactionId: null | number;
  updatedAt: Date;
}

export interface ServicesFilterState {
  search: string;
  statuses: Set<"ACTIVE" | "ARCHIVED" | "INACTIVE">;
  types: Set<ServiceType>;
}

export interface ServiceSummary {
  accountReference: null | string;
  amountIndexation: ServiceAmountIndexation;
  category: null | string;
  counterpartAccountBankName: null | string;
  counterpartAccountId: null | number;
  counterpartAccountIdentifier: null | string;
  counterpartAccountType: null | string;
  counterpartId: null | number;
  counterpartName: null | string;
  createdAt: Date;
  defaultAmount: number;
  detail: null | string;
  dueDay: null | number;
  emissionDay: null | number;
  emissionEndDay: null | number;
  emissionExactDate: null | Date;
  emissionMode: ServiceEmissionMode;
  emissionStartDay: null | number;
  frequency: ServiceFrequency;
  id: number;
  lateFeeGraceDays: null | number;
  lateFeeMode: ServiceLateFeeMode;
  lateFeeValue: null | number;
  name: string;
  nextGenerationMonths: number;
  notes: null | string;
  obligationType: ServiceObligationType;
  overdueCount: number;
  ownership: ServiceOwnership;
  pendingCount: number;
  publicId: string;
  recurrenceType: ServiceRecurrenceType;
  serviceType: ServiceType;
  startDate: Date;
  status: "ACTIVE" | "ARCHIVED" | "INACTIVE";
  totalExpected: number;
  totalPaid: number;
  updatedAt: Date;
}

export interface ServiceTemplate {
  category?: string;
  description: string;
  id: string;
  name: string;
  payload: Partial<CreateServicePayload>;
}

export type ServiceType =
  | "BUSINESS"
  | "LEASE"
  | "OTHER"
  | "PERSONAL"
  | "SOFTWARE"
  | "SUPPLIER"
  | "TAX"
  | "UTILITY";

export interface SummaryTotals {
  activeCount: number;
  overdueCount: number;
  pendingCount: number;
  totalExpected: number;
  totalPaid: number;
}
