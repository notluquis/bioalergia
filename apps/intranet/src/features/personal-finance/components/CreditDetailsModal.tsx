"use client";

import { Button, Chip, Modal } from "@heroui/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { personalFinanceQueries } from "../queries";
import type { PersonalCreditInstallment } from "../types";
import { PayInstallmentModal } from "./PayInstallmentModal";

interface CreditDetailsModalProps {
  creditId: number | null;
  onClose: () => void;
}

export function CreditDetailsModal({ creditId, onClose }: CreditDetailsModalProps) {
  const isOpen = creditId !== null;

  if (!creditId) {
    return null;
  }

  return <CreditDetailsModalContent creditId={creditId} isOpen={isOpen} onClose={onClose} />;
}

function CreditDetailsModalContent({
  creditId,
  isOpen,
  onClose,
}: {
  creditId: number;
  isOpen: boolean;
  onClose: () => void;
}) {
  const { data: credit } = useSuspenseQuery(personalFinanceQueries.detail(creditId));

  if (!credit) {
    return null;
  }

  return (
    <Modal>
      <Modal.Backdrop
        isOpen={isOpen}
        onOpenChange={(open) => {
          if (!open) {
            onClose();
          }
        }}
      >
        <Modal.Container className="max-h-[90vh] overflow-hidden">
          <Modal.Dialog className="flex flex-col h-full">
            <Modal.CloseTrigger onClick={onClose} />

            <Modal.Header className="flex-col items-start gap-2 border-b border-border py-5">
              <div className="flex w-full items-center justify-between">
                <Modal.Heading className="font-bold text-xl">{credit.bankName}</Modal.Heading>
                <Chip
                  color={credit.status === "ACTIVE" ? "success" : "default"}
                  variant="soft"
                  size="sm"
                >
                  {credit.status}
                </Chip>
              </div>
              <p className="text-sm text-muted">
                {credit.description || `Crédito Nº ${credit.creditNumber}`}
              </p>
            </Modal.Header>

            <Modal.Body className="flex-1 overflow-y-auto py-6">
              <div className="space-y-2">
                {credit.installments?.map((installment) => (
                  <InstallmentRow
                    key={installment.id}
                    creditId={creditId}
                    installment={installment}
                    currency={credit.currency}
                  />
                ))}
              </div>
            </Modal.Body>

            <Modal.Footer className="border-t border-border py-4">
              <Button slot="close" variant="secondary" onPress={onClose}>
                Cerrar
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

function InstallmentRow({
  creditId,
  installment,
  currency,
}: {
  creditId: number;
  installment: PersonalCreditInstallment;
  currency: string;
}) {
  const isPaid = installment.status === "PAID";
  const dueDate = dayjs(installment.dueDate).format("DD/MM/YYYY");
  const dueDateObj = dayjs(installment.dueDate);
  const isOverdue = dueDateObj.isBefore(dayjs()) && !isPaid;

  const StatusIcon = isPaid ? CheckCircle2 : isOverdue ? AlertCircle : Clock;
  const statusColor = isPaid
    ? "bg-success/10 text-success"
    : isOverdue
      ? "bg-danger/10 text-danger"
      : "bg-warning/10 text-warning";

  return (
    <div className="rounded-xl border border-border bg-transparent transition-all duration-200 hover:border-accent/50 hover:shadow-sm">
      <div className="p-4">
        <div className="flex items-start justify-between gap-4">
          {/* Icon Status */}
          <div
            className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${statusColor}`}
          >
            <StatusIcon className="size-5" />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center justify-between gap-3">
              <p className="font-medium text-sm">Cuota {installment.installmentNumber}</p>
              <p className="font-semibold text-sm">
                {formatCurrency(Number(installment.amount), currency)}
              </p>
            </div>
            <p className={`text-xs ${isOverdue ? "text-danger font-medium" : "text-muted"}`}>
              Vence: {dueDate}
              {isOverdue && " (Vencida)"}
            </p>
          </div>
        </div>

        {/* Actions Row */}
        <div className="mt-3 flex items-center justify-between gap-3">
          <Chip
            color={isPaid ? "success" : isOverdue ? "danger" : "warning"}
            variant="soft"
            size="sm"
          >
            {isPaid ? "Pagada" : isOverdue ? "Vencida" : "Pendiente"}
          </Chip>

          {!isPaid && (
            <PayInstallmentModal creditId={creditId} installment={installment} iconOnly />
          )}
        </div>
      </div>
    </div>
  );
}
