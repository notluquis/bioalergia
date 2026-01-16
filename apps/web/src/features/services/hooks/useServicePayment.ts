import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useStore } from "@tanstack/react-store";
import dayjs from "dayjs";

import { fetchTransactions } from "@/features/finance/api";
import type { Transaction } from "@/features/finance/types";

import { extractErrorMessage, registerServicePayment } from "../api";
import { serviceKeys } from "../queries";
import { servicesActions, servicesStore } from "../store";
import type { ServicePaymentPayload } from "../types";

export function useServicePayment() {
  const queryClient = useQueryClient();

  // Store
  const paymentSchedule = useStore(servicesStore, (state) => state.paymentSchedule);
  const paymentForm = useStore(servicesStore, (state) => state.paymentForm);

  // Suggested Transactions
  const { data: suggestedTransactions } = useSuspenseQuery({
    // eslint-disable-next-line @tanstack/query/exhaustive-deps
    queryKey: ["payment-suggestions", paymentSchedule?.id, paymentSchedule?.expected_amount, paymentSchedule?.due_date],
    queryFn: async () => {
      if (!paymentSchedule) return [];
      const tolerance = Math.max(100, Math.round(paymentSchedule.expected_amount * 0.01));
      const dueDate = paymentSchedule.due_date ? dayjs(paymentSchedule.due_date) : dayjs();
      const from = dueDate.clone().subtract(45, "day").format("YYYY-MM-DD");
      const to = dueDate.clone().add(45, "day").format("YYYY-MM-DD");

      const payload = await fetchTransactions({
        filters: {
          from,
          to,
          // Empty filters to get broad range
          description: "",
          origin: "",
          destination: "",
          sourceId: "",
          bankAccountNumber: "",
          direction: "OUT",
          includeAmounts: true,
          externalReference: "",
          transactionType: "",
          status: "",
        },
        page: 1,
        pageSize: 50,
      });

      return payload.data
        .filter(
          (tx) =>
            typeof tx.transactionAmount === "number" &&
            Math.abs((tx.transactionAmount ?? 0) - paymentSchedule.expected_amount) <= tolerance
        )
        .slice(0, 8);
    },
  });

  // Pay Mutation
  const paymentMutation = useMutation({
    mutationFn: async (payload: { scheduleId: number; body: ServicePaymentPayload }) => {
      return registerServicePayment(payload.scheduleId, payload.body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: serviceKeys.lists() });
      queryClient.invalidateQueries({ queryKey: serviceKeys.details() });
      servicesActions.closePaymentModal();
    },
  });

  // Actions
  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentSchedule) return;
    const transactionId = Number(paymentForm.transactionId);
    if (!Number.isFinite(transactionId) || transactionId <= 0) return;

    await paymentMutation.mutateAsync({
      scheduleId: paymentSchedule.id,
      body: {
        transactionId,
        paidAmount: Number(paymentForm.paidAmount),
        paidDate: paymentForm.paidDate,
        note: paymentForm.note || undefined,
      },
    });
  };

  const applySuggestedTransaction = (tx: Transaction) => {
    if (!tx.transactionAmount) return;
    servicesActions.updatePaymentForm({
      transactionId: String(tx.id),
      paidAmount: String(tx.transactionAmount),
      paidDate: tx.transactionDate ? dayjs(tx.transactionDate).format("YYYY-MM-DD") : paymentForm.paidDate,
    });
  };

  return {
    // State
    paymentSchedule,
    paymentForm,
    handlePaymentFieldChange: (key: keyof typeof paymentForm, value: string) =>
      servicesActions.updatePaymentForm({ [key]: value }),

    // Suggestions
    suggestedTransactions,
    applySuggestedTransaction,

    // Mutation
    handlePaymentSubmit,
    paymentPending: paymentMutation.isPending,
    paymentError: extractErrorMessage(paymentMutation.error),

    // Modal Control
    openPaymentModal: servicesActions.openPaymentModal,
    closePaymentModal: servicesActions.closePaymentModal,
  };
}
