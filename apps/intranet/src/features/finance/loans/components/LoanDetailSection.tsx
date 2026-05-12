import { useSuspenseQuery } from "@tanstack/react-query";
import { LoanDetail } from "@/features/finance/loans/components/LoanDetail";
import { loanKeys } from "@/features/finance/loans/queries";
import type { LoanSchedule, RegenerateSchedulePayload } from "@/features/finance/loans/types";

interface LoanDetailSectionProps {
  canManage: boolean;
  loanId: string;
  onRegenerate: (overrides: RegenerateSchedulePayload) => Promise<void>;
  onRegisterPayment: (schedule: LoanSchedule) => void;
  onUnlinkPayment: (schedule: LoanSchedule) => void;
}
export function LoanDetailSection({
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
