import { useSuspenseQuery } from "@tanstack/react-query";

import LoanDetail from "@/features/finance/loans/components/LoanDetail";
import { loanKeys } from "@/features/finance/loans/queries";
import type { LoanSchedule, RegenerateSchedulePayload } from "@/features/finance/loans/types";

interface LoanDetailSectionProps {
  loanId: string;
  canManage: boolean;
  onRegenerate: (overrides: RegenerateSchedulePayload) => Promise<void>;
  onRegisterPayment: (schedule: LoanSchedule) => void;
  onUnlinkPayment: (schedule: LoanSchedule) => void;
}

export default function LoanDetailSection({
  loanId,
  canManage,
  onRegenerate,
  onRegisterPayment,
  onUnlinkPayment,
}: LoanDetailSectionProps) {
  const { data } = useSuspenseQuery(loanKeys.detail(loanId));
  const { loan, schedules, summary } = data;

  return (
    <LoanDetail
      loan={loan}
      schedules={schedules}
      summary={summary}
      loading={false}
      canManage={canManage}
      onRegenerate={onRegenerate}
      onRegisterPayment={onRegisterPayment}
      onUnlinkPayment={onUnlinkPayment}
    />
  );
}
