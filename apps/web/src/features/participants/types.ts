export type ParticipantMonthlyRow = {
  month: string;
  outgoingCount: number;
  incomingCount: number;
  outgoingAmount: number;
  incomingAmount: number;
};

export type ParticipantCounterpartRow = {
  counterpart: string;
  counterpartId: string | null;
  withdrawId: string | null;
  bankAccountHolder: string | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  bankAccountType: string | null;
  bankBranch: string | null;
  identificationType: string | null;
  identificationNumber: string | null;
  outgoingCount: number;
  incomingCount: number;
  outgoingAmount: number;
  incomingAmount: number;
};

export type ParticipantSummaryRow = {
  participant: string;
  displayName: string;
  outgoingCount: number;
  identificationNumber: string | null;
  bankAccountHolder: string | null;
  bankAccountNumber: string | null;
  bankAccountType: string | null;
  bankName: string | null;
  bankBranch: string | null;
  withdrawId: string | null;
  incomingCount: number;
  outgoingAmount: number;
  incomingAmount: number;
  totalCount: number;
  totalAmount: number;
};

export type ParticipantInsightResponse = {
  status: "ok";
  participant: string;
  monthly: ParticipantMonthlyRow[];
  counterparts: ParticipantCounterpartRow[];
};

export type ParticipantLeaderboardResponse = {
  status: "ok";
  participants: ParticipantSummaryRow[];
};

export type LeaderboardDisplayRow = {
  key: string;
  displayName: string;
  rut: string;
  account: string;
  outgoingCount: number;
  outgoingAmount: number;
  selectKey: string;
};
