export interface CreateLoanPayload {
  borrowerName: string;
  borrowerType: "COMPANY" | "PERSON";
  frequency: "BIWEEKLY" | "MONTHLY" | "WEEKLY";
  generateSchedule?: boolean;
  interestRate: number;
  interestType: "COMPOUND" | "SIMPLE";
  notes?: null | string;
  principalAmount: number;
  startDate: Date;
  title: string;
  totalInstallments: number;
}

export interface LoanDetailResponse {
  loan: LoanSummary;
  schedules: LoanSchedule[];
  status: "error" | "ok";
  summary: {
    paid_installments: number;
    pending_installments: number;
    remaining_amount: number;
    total_expected: number;
    total_paid: number;
  };
}

export interface LoanListResponse {
  loans: LoanSummary[];
  status: "error" | "ok";
}

export interface LoanPaymentPayload {
  paidAmount: number;
  paidDate: Date;
  transactionId: number;
}

export interface LoanSchedule {
  created_at: Date;
  due_date: Date;
  expected_amount: number;
  expected_interest: number;
  expected_principal: number;
  id: number;
  installment_number: number;
  loan_id: number;
  paid_amount: null | number;
  paid_date: null | Date;
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

export interface LoanSummary {
  borrower_name: string;
  borrower_type: "COMPANY" | "PERSON";
  created_at: Date;
  frequency: "BIWEEKLY" | "MONTHLY" | "WEEKLY";
  id: number;
  interest_rate: number;
  interest_type: "COMPOUND" | "SIMPLE";
  notes: null | string;
  paid_installments: number;
  pending_installments: number;
  principal_amount: number;
  public_id: string;
  remaining_amount: number;
  start_date: Date;
  status: "ACTIVE" | "COMPLETED" | "DEFAULTED";
  title: string;
  total_expected: number;
  total_installments: number;
  total_paid: number;
  updated_at: Date;
}

export interface RegenerateSchedulePayload {
  frequency?: "BIWEEKLY" | "MONTHLY" | "WEEKLY";
  interestRate?: number;
  startDate?: Date;
  totalInstallments?: number;
}
