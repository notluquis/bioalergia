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
  const scheduleId = paymentSchedule?.id;
  const expectedAmount = paymentSchedule?.expectedAmount;
  const dueDate = paymentSchedule?.dueDate;

  const { data: suggestedTransactions } = useSuspenseQuery({
    queryFn: async () => {
      if (!scheduleId || expectedAmount == null) {
        return [];
      }
      const tolerance = Math.max(100, Math.round(expectedAmount * 0.01));
      const dueDateValue = dueDate ? dayjs(dueDate) : dayjs();
      const from = dueDateValue.clone().subtract(45, "day").format("YYYY-MM-DD");
      const to = dueDateValue.clone().add(45, "day").format("YYYY-MM-DD");

      const payload = await fetchTransactions({
        filters: {
          bankAccountNumber: "",
          // Empty filters to get broad range
          description: "",
          destination: "",
          direction: "OUT",
          externalReference: "",
          from,
          includeAmounts: true,
          origin: "",
          sourceId: "",
          status: "",
          to,
          transactionType: "",
        },
        includeTotal: false,
        page: 1,
        pageSize: 50,
      });

      return payload.data
        .filter(
          (tx) =>
            typeof tx.transactionAmount === "number" &&
            Math.abs(tx.transactionAmount - expectedAmount) <= tolerance,
        )
        .slice(0, 8);
    },
    queryKey: ["payment-suggestions", scheduleId, expectedAmount, dueDate],
  });

  // Pay Mutation
  const paymentMutation = useMutation({
    mutationFn: async (payload: { body: ServicePaymentPayload; scheduleId: number }) => {
      return registerServicePayment(payload.scheduleId, payload.body);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: serviceKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: serviceKeys.details() });
      servicesActions.closePaymentModal();
    },
  });

  // Actions
  const handlePaymentSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!paymentSchedule) {
      return;
    }
    const transactionId = Number(paymentForm.transactionId);
    if (!Number.isFinite(transactionId) || transactionId <= 0) {
      return;
    }

    await paymentMutation.mutateAsync({
      body: {
        note: paymentForm.note || undefined,
        paidAmount: Number(paymentForm.paidAmount),
        paidDate: paymentForm.paidDate,
        transactionId,
      },
      scheduleId: paymentSchedule.id,
    });
  };

  const applySuggestedTransaction = (tx: Transaction) => {
    if (!tx.transactionAmount) {
      return;
    }
    servicesActions.updatePaymentForm({
      paidAmount: String(tx.transactionAmount),
      paidDate: tx.transactionDate ?? paymentForm.paidDate,
      transactionId: String(tx.id),
    });
  };

  return {
    applySuggestedTransaction,
    closePaymentModal: servicesActions.closePaymentModal,
    handlePaymentFieldChange: (key: keyof typeof paymentForm, value: string | Date) => {
      if (key === "paidDate") {
        const dateValue = value instanceof Date ? value : dayjs(value).toDate();
        servicesActions.updatePaymentForm({ paidDate: dateValue });
        return;
      }
      servicesActions.updatePaymentForm({ [key]: value });
    },

    // Mutation
    handlePaymentSubmit,
    // Modal Control
    openPaymentModal: servicesActions.openPaymentModal,

    paymentError: extractErrorMessage(paymentMutation.error),
    paymentForm,
    paymentPending: paymentMutation.isPending,

    // State
    paymentSchedule,
    // Suggestions
    suggestedTransactions,
  };
}
