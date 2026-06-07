export interface CreateLoanPayload {
  borrowerName: string;
  borrowerType: "COMPANY" | "PERSON";
  frequency: "BIWEEKLY" | "MONTHLY" | "WEEKLY";
  generateSchedule?: boolean;
  interestRate: number;
  interestType: "COMPOUND" | "SIMPLE";
  notes?: null | string;
  principalAmount: number;
  startDate: string; // YYYY-MM-DD
  title: string;
  totalInstallments: number;
}

export interface LoanDetailResponse {
  loan: LoanSummary;
  schedules: LoanSchedule[];
  sources?: LoanSource[];
  status: "error" | "ok";
  summary: {
    paid_installments: number;
    pending_installments: number;
    remaining_amount: number;
    total_expected: number;
    total_paid: number;
  };
}

export interface CreateStructuredLoanPayload {
  borrowerName: string;
  borrowerType: "COMPANY" | "PERSON";
  equalSchedule?: {
    firstDueDate: string;
    frequency: "BIWEEKLY" | "IRREGULAR" | "MONTHLY" | "WEEKLY";
    installments: number;
  };
  manualInstallments?: StructuredLoanInstallmentPayload[];
  notes?: null | string;
  sources: StructuredLoanSourcePayload[];
  startDate: string;
  title: string;
}

export interface StructuredLoanSourcePayload {
  disbursementDate?: string;
  feeAmount?: number;
  fixedInterestRate?: number;
  label: string;
  note?: null | string;
  principalAmount: number;
  sourceType?: "BANK_CREDIT" | "CREDIT_CARD" | "OTHER" | "PERSON_LOAN" | "TRANSFER";
  totalAmount?: number;
}

export interface StructuredLoanInstallmentPayload {
  dueDate: string;
  expectedAmount: number;
  expectedInterest?: number;
  expectedPrincipal?: number;
  note?: null | string;
  payments?: StructuredLoanPaymentPayload[];
}

export interface StructuredLoanPaymentPayload {
  amount: number;
  kind?: "ADJUSTMENT" | "DISCOUNT" | "PAYMENT";
  note?: null | string;
  paidDate: string;
  transactionId?: number;
}

export interface LoanListResponse {
  loans: LoanSummary[];
  status: "error" | "ok";
}

export interface LoanPaymentPayload {
  paidAmount: number;
  paidDate: string; // YYYY-MM-DD
  transactionId: number;
}

export interface LoanSchedule {
  created_at: Date;
  due_date: string;
  expected_amount: number;
  expected_interest: number;
  expected_principal: number;
  id: number;
  installment_number: number;
  loan_id: number;
  paid_amount: null | number;
  paid_date: null | string;
  payments?: LoanSchedulePayment[];
  status: "OVERDUE" | "PAID" | "PARTIAL" | "PENDING" | "SKIPPED";
  transaction?: null | {
    amount: null | number;
    description: null | string;
    id: number;
    timestamp: Date;
  };
  transaction_id: null | number;
  updated_at: Date;
}

export interface LoanSchedulePayment {
  amount: number;
  id: number;
  kind: "ADJUSTMENT" | "DISCOUNT" | "PAYMENT";
  note: null | string;
  paid_date: string;
  transaction?: null | {
    amount: null | number;
    description: null | string;
    id: number;
    timestamp: Date;
  };
  transaction_id: null | number;
}

export interface LoanSource {
  disbursement_date: null | string;
  fee_amount: number;
  fixed_interest_rate: number;
  id: number;
  interest_amount: number;
  label: string;
  note: null | string;
  principal_amount: number;
  source_type: "BANK_CREDIT" | "CREDIT_CARD" | "OTHER" | "PERSON_LOAN" | "TRANSFER";
  total_amount: number;
}

export interface LoanSummary {
  borrower_name: string;
  borrower_type: "COMPANY" | "PERSON";
  created_at: Date;
  frequency: "BIWEEKLY" | "IRREGULAR" | "MONTHLY" | "WEEKLY";
  id: number;
  interest_rate: number;
  interest_type: "COMPOUND" | "SIMPLE";
  notes: null | string;
  paid_installments: number;
  pending_installments: number;
  principal_amount: number;
  public_id: string;
  remaining_amount: number;
  start_date: string;
  status: "ACTIVE" | "COMPLETED" | "DEFAULTED";
  title: string;
  total_expected: number;
  total_installments: number;
  total_paid: number;
  updated_at: Date;
}

export interface RegenerateSchedulePayload {
  frequency?: "BIWEEKLY" | "IRREGULAR" | "MONTHLY" | "WEEKLY";
  interestRate?: number;
  startDate?: string; // YYYY-MM-DD
  totalInstallments?: number;
}
