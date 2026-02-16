import { useSuspenseQuery } from "@tanstack/react-query";
import { AssociatedAccounts } from "@/features/counterparts/components/AssociatedAccounts";
import { counterpartKeys } from "@/features/counterparts/queries";
import type { Counterpart } from "@/features/counterparts/types";

interface CounterpartDetailSectionProps {
  canUpdate: boolean;
  counterpartId: number;
  onEdit: (counterpart: Counterpart) => void;
}
export function CounterpartDetailSection({
  canUpdate,
  counterpartId,
  onEdit,
}: Readonly<CounterpartDetailSectionProps>) {
  const { data: detail } = useSuspenseQuery(counterpartKeys.detail(counterpartId));

  if (!detail) {
    return null; // Should not happen with suspense if data exists
  }

  return (
    <AssociatedAccounts
      canUpdate={canUpdate}
      detail={detail}
      onEdit={onEdit}
      selectedId={counterpartId}
    />
  );
}
