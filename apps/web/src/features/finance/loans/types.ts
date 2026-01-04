export type LoanSummary = {
  id: number;
  public_id: string;
  title: string;
  borrower_name: string;
  borrower_type: "PERSON" | "COMPANY";
  principal_amount: number;
  interest_rate: number;
  interest_type: "SIMPLE" | "COMPOUND";
  frequency: "WEEKLY" | "BIWEEKLY" | "MONTHLY";
  total_installments: number;
  start_date: string;
  status: "ACTIVE" | "COMPLETED" | "DEFAULTED";
  notes: string | null;
  created_at: string;
  updated_at: string;
  total_expected: number;
  total_paid: number;
  remaining_amount: number;
  paid_installments: number;
  pending_installments: number;
};

export type LoanSchedule = {
  id: number;
  loan_id: number;
  installment_number: number;
  due_date: string;
  expected_amount: number;
  expected_principal: number;
  expected_interest: number;
  status: "PENDING" | "PARTIAL" | "PAID" | "OVERDUE";
  transaction_id: number | null;
  paid_amount: number | null;
  paid_date: string | null;
  created_at: string;
  updated_at: string;
  transaction?: {
    id: number;
    description: string | null;
    timestamp: string;
    amount: number | null;
  } | null;
};

export type LoanDetailResponse = {
  status: "ok" | "error";
  loan: LoanSummary;
  schedules: LoanSchedule[];
  summary: {
    total_expected: number;
    total_paid: number;
    remaining_amount: number;
    paid_installments: number;
    pending_installments: number;
  };
};

export type LoanListResponse = {
  status: "ok" | "error";
  loans: LoanSummary[];
};

export type CreateLoanPayload = {
  title: string;
  borrowerName: string;
  borrowerType: "PERSON" | "COMPANY";
  principalAmount: number;
  interestRate: number;
  interestType: "SIMPLE" | "COMPOUND";
  frequency: "WEEKLY" | "BIWEEKLY" | "MONTHLY";
  totalInstallments: number;
  startDate: string;
  notes?: string | null;
  generateSchedule?: boolean;
};

export type RegenerateSchedulePayload = {
  totalInstallments?: number;
  startDate?: string;
  interestRate?: number;
  frequency?: "WEEKLY" | "BIWEEKLY" | "MONTHLY";
};

export type LoanPaymentPayload = {
  transactionId: number;
  paidAmount: number;
  paidDate: string;
};
