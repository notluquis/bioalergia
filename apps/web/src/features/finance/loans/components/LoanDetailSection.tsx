import { useSuspenseQuery } from "@tanstack/react-query";

import type { LoanSchedule, RegenerateSchedulePayload } from "@/features/finance/loans/types";

import LoanDetail from "@/features/finance/loans/components/LoanDetail";
import { loanKeys } from "@/features/finance/loans/queries";

interface LoanDetailSectionProps {
  canManage: boolean;
  loanId: string;
  onRegenerate: (overrides: RegenerateSchedulePayload) => Promise<void>;
  onRegisterPayment: (schedule: LoanSchedule) => void;
  onUnlinkPayment: (schedule: LoanSchedule) => void;
}

export default function LoanDetailSection({
  canManage,
  loanId,
  onRegenerate,
  onRegisterPayment,
  onUnlinkPayment,
}: LoanDetailSectionProps) {
  const { data } = useSuspenseQuery(loanKeys.detail(loanId));
  const { loan, schedules, summary } = data;

  return (
    <LoanDetail
      canManage={canManage}
      loading={false}
      loan={loan}
      onRegenerate={onRegenerate}
      onRegisterPayment={onRegisterPayment}
      onUnlinkPayment={onUnlinkPayment}
      schedules={schedules}
      summary={summary}
    />
  );
}
