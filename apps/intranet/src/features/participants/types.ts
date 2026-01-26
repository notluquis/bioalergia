export interface LeaderboardDisplayRow {
  account: string;
  displayName: string;
  key: string;
  outgoingAmount: number;
  outgoingCount: number;
  rut: string;
  selectKey: string;
}

export interface ParticipantCounterpartRow {
  bankAccountHolder: null | string;
  bankAccountNumber: null | string;
  bankAccountType: null | string;
  bankBranch: null | string;
  bankName: null | string;
  counterpart: string;
  counterpartId: null | string;
  identificationNumber: null | string;
  identificationType: null | string;
  incomingAmount: number;
  incomingCount: number;
  outgoingAmount: number;
  outgoingCount: number;
  withdrawId: null | string;
}

export interface ParticipantInsightResponse {
  counterparts: ParticipantCounterpartRow[];
  monthly: ParticipantMonthlyRow[];
  participant: string;
  status: "ok";
}

export interface ParticipantLeaderboardResponse {
  participants: ParticipantSummaryRow[];
  status: "ok";
}

export interface ParticipantMonthlyRow {
  incomingAmount: number;
  incomingCount: number;
  month: string;
  outgoingAmount: number;
  outgoingCount: number;
}

export interface ParticipantSummaryRow {
  bankAccountHolder: null | string;
  bankAccountNumber: null | string;
  bankAccountType: null | string;
  bankBranch: null | string;
  bankName: null | string;
  displayName: string;
  identificationNumber: null | string;
  incomingAmount: number;
  incomingCount: number;
  outgoingAmount: number;
  outgoingCount: number;
  participant: string;
  totalAmount: number;
  totalCount: number;
  withdrawId: null | string;
}
