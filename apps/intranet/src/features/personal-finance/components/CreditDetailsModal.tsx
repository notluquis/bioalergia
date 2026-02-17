"use client";

import { Button, Chip, Disclosure, DisclosureGroup, Modal } from "@heroui/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { personalFinanceQueries } from "../queries";
import type { PersonalCreditInstallment } from "../types";

interface CreditDetailsModalProps {
  creditId: number | null;
  onClose: () => void;
}

export function CreditDetailsModal({ creditId, onClose }: CreditDetailsModalProps) {
  const isOpen = creditId !== null;

  if (!creditId) {
    return (
      <Modal isOpen={false}>
        <Modal.Backdrop />
      </Modal>
    );
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
    <Modal isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Modal.Backdrop>
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
              <DisclosureGroup className="space-y-2">
                {credit.installments?.map((installment) => (
                  <InstallmentRow
                    key={installment.id}
                    installment={installment}
                    currency={credit.currency}
                  />
                ))}
              </DisclosureGroup>
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
  installment,
  currency,
}: {
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
    <Disclosure>
      <Disclosure.Heading>
        <Disclosure.Trigger className="w-full text-left">
          <div className="cursor-pointer rounded-xl border border-border bg-transparent transition-all duration-200 hover:border-accent/50 hover:shadow-sm">
            <div className="p-4">
              <div className="flex items-center justify-between gap-4">
                {/* Icon Status */}
                <div
                  className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${statusColor}`}
                >
                  <StatusIcon className="size-5" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">
                    Cuota {installment.installmentNumber}
                  </p>
                  <p
                    className={`text-xs truncate ${isOverdue ? "text-danger font-medium" : "text-muted"}`}
                  >
                    Vence: {dueDate}
                    {isOverdue && " (Vencida)"}
                  </p>
                </div>

                {/* Amount & Status */}
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <p className="font-semibold text-sm">
                      {formatCurrency(Number(installment.amount), currency)}
                    </p>
                    <Chip
                      color={isPaid ? "success" : isOverdue ? "danger" : "warning"}
                      variant="soft"
                      size="sm"
                      className="mt-1"
                    >
                      {isPaid ? "Pagada" : isOverdue ? "Vencida" : "Pendiente"}
                    </Chip>
                  </div>
                  <Disclosure.Indicator className="text-muted transition-transform" />
                </div>
              </div>
            </div>
          </div>
        </Disclosure.Trigger>
      </Disclosure.Heading>

      <Disclosure.Content>
        <Disclosure.Body className="mt-2 rounded-xl bg-surface p-4 shadow-panel space-y-4">
          {/* Details Grid */}
          <div className="rounded-lg bg-background/50 p-3 space-y-2.5">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted">Monto:</span>
              <span className="font-semibold">
                {formatCurrency(Number(installment.amount), currency)}
              </span>
            </div>
            {installment.paidAmount && (
              <div className="flex justify-between items-center text-sm border-t border-border/50 pt-2.5">
                <span className="text-muted">Pagado:</span>
                <span className="font-semibold text-success">
                  {formatCurrency(Number(installment.paidAmount), currency)}
                </span>
              </div>
            )}
            {installment.capitalAmount && (
              <div className="flex justify-between items-center text-sm border-t border-border/50 pt-2.5">
                <span className="text-muted">Capital:</span>
                <span className="font-medium">
                  {formatCurrency(Number(installment.capitalAmount), currency)}
                </span>
              </div>
            )}
            {installment.interestAmount && (
              <div className="flex justify-between items-center text-sm border-t border-border/50 pt-2.5">
                <span className="text-muted">Interés:</span>
                <span className="font-medium">
                  {formatCurrency(Number(installment.interestAmount), currency)}
                </span>
              </div>
            )}
          </div>

          {/* Payment Button */}
          {!isPaid && (
            <Button
              variant="secondary"
              size="sm"
              className="w-full"
              onPress={async () => {
                // TODO: Implementar mutation para pagar cuota
                // await payInstallmentMutation.mutateAsync({
                //   creditId: creditId,
                //   installmentNumber: installment.installmentNumber,
                // });
              }}
            >
              Marcar como pagada
            </Button>
          )}
        </Disclosure.Body>
      </Disclosure.Content>
    </Disclosure>
  );
}
