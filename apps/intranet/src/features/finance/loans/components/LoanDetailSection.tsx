import { useSuspenseQuery } from "@tanstack/react-query";
import { LoanDetail } from "@/features/finance/loans/components/LoanDetail";
import { loanKeys } from "@/features/finance/loans/queries";
import type {
  LoanSchedule,
  LoanSummary,
  RegenerateSchedulePayload,
} from "@/features/finance/loans/types";

interface LoanDetailSectionProps {
  canDelete: boolean;
  canManage: boolean;
  loanId: string;
  onDeleteRequest: (loan: LoanSummary) => void;
  onEditRequest: (loan: LoanSummary) => void;
  onEditSchedule: (schedule: LoanSchedule) => void;
  onRegenerate: (overrides: RegenerateSchedulePayload) => Promise<void>;
  onRegisterPayment: (schedule: LoanSchedule) => void;
  onUnlinkPayment: (schedule: LoanSchedule) => void;
}
export function LoanDetailSection({
  canManage,
  canDelete,
  loanId,
  onDeleteRequest,
  onEditRequest,
  onEditSchedule,
  onRegenerate,
  onRegisterPayment,
  onUnlinkPayment,
}: LoanDetailSectionProps) {
  const { data } = useSuspenseQuery(loanKeys.detail(loanId));
  const { loan, schedules, sources, summary } = data;

  return (
    <LoanDetail
      canDelete={canDelete}
      canManage={canManage}
      loading={false}
      loan={loan}
      onDeleteRequest={onDeleteRequest}
      onEditRequest={onEditRequest}
      onEditSchedule={onEditSchedule}
      onRegenerate={onRegenerate}
      onRegisterPayment={onRegisterPayment}
      onUnlinkPayment={onUnlinkPayment}
      schedules={schedules}
      sources={sources}
      summary={summary}
    />
  );
}
