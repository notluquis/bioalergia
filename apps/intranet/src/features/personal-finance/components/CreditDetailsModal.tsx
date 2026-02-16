"use client";

import { Button, Card, Chip, Disclosure, DisclosureGroup, Modal, Switch } from "@heroui/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
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

  const paidCount = credit.installments?.filter((i) => i.status === "PAID").length || 0;
  const totalCount = credit.totalInstallments || 1;
  const percent = Math.min(100, Math.round((paidCount / totalCount) * 100));

  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Modal.Backdrop>
        <Modal.Container className="max-h-[90vh] overflow-hidden">
          <Modal.Dialog className="flex flex-col h-full">
            <Modal.CloseTrigger onClick={onClose} />
            <Modal.Header className="flex-col items-start gap-2 py-4!">
              <div className="flex w-full items-center justify-between">
                <Modal.Heading className="text-xl">{credit.bankName}</Modal.Heading>
                <Chip color={credit.status === "ACTIVE" ? "success" : "default"} size="sm">
                  {credit.status}
                </Chip>
              </div>
              <p className="text-sm text-default-500">
                {credit.description || credit.creditNumber}
              </p>
            </Modal.Header>

            <Modal.Body className="flex-1 overflow-y-auto gap-4 py-4!">
              {/* Info Cards */}
              <div className="grid gap-3 md:grid-cols-2">
                <Card className="bg-default-50">
                  <Card.Header className="flex-col items-start pb-2">
                    <Card.Title className="text-xs font-medium text-default-600">
                      Monto Total
                    </Card.Title>
                  </Card.Header>
                  <Card.Content>
                    <div className="font-bold text-lg">
                      {formatCurrency(Number(credit.totalAmount), credit.currency)}
                    </div>
                  </Card.Content>
                </Card>

                <Card className="bg-default-50">
                  <Card.Header className="flex-col items-start pb-2">
                    <Card.Title className="text-xs font-medium text-default-600">
                      Cuotas Pagadas
                    </Card.Title>
                  </Card.Header>
                  <Card.Content>
                    <div className="font-bold text-lg">
                      {paidCount} / {totalCount}
                    </div>
                  </Card.Content>
                </Card>

                {credit.interestRate && (
                  <Card className="bg-default-50">
                    <Card.Header className="flex-col items-start pb-2">
                      <Card.Title className="text-xs font-medium text-default-600">
                        Tasa de Interés
                      </Card.Title>
                    </Card.Header>
                    <Card.Content>
                      <div className="font-bold text-lg">{credit.interestRate}%</div>
                    </Card.Content>
                  </Card>
                )}

                <Card className="bg-default-50">
                  <Card.Header className="flex-col items-start pb-2">
                    <Card.Title className="text-xs font-medium text-default-600">
                      Progreso
                    </Card.Title>
                  </Card.Header>
                  <Card.Content>
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 rounded-full bg-default-200">
                        <div
                          className="h-2 rounded-full bg-primary transition-all"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium">{percent}%</span>
                    </div>
                  </Card.Content>
                </Card>
              </div>

              {/* Tabla de Amortización */}
              <div className="space-y-2">
                <h3 className="font-semibold text-sm">Tabla de Amortización</h3>
                <DisclosureGroup>
                  {credit.installments?.map((installment) => (
                    <InstallmentRow
                      key={installment.id}
                      installment={installment}
                      currency={credit.currency}
                    />
                  ))}
                </DisclosureGroup>
              </div>
            </Modal.Body>

            <Modal.Footer className="py-3!">
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

  return (
    <Disclosure>
      <Disclosure.Trigger>
        <div className="flex cursor-pointer items-center justify-between rounded-lg border border-default-200 bg-default-50 px-4 py-3 hover:bg-default-100">
          <div className="flex flex-1 items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-full bg-default-200">
              {isPaid ? (
                <span className="text-xs font-bold text-success">✓</span>
              ) : (
                <span className="text-xs font-semibold">{installment.installmentNumber}</span>
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">Cuota {installment.installmentNumber}</p>
              <p className={`text-xs ${isOverdue ? "text-danger" : "text-default-500"}`}>
                Vence: {dueDate}
                {isOverdue && " (Vencida)"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="font-semibold">
                {formatCurrency(Number(installment.amount), currency)}
              </p>
              <Chip
                color={isPaid ? "success" : isOverdue ? "danger" : "warning"}
                variant="soft"
                size="sm"
              >
                {isPaid ? "Pagada" : isOverdue ? "Vencida" : "Pendiente"}
              </Chip>
            </div>
            <Disclosure.Indicator className="ml-auto text-default-400" />
          </div>
        </div>
      </Disclosure.Trigger>

      <Disclosure.Content>
        <div className="border-x border-b border-default-200 bg-default-50 px-4 py-3 space-y-3">
          <div className="rounded-lg bg-background p-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-default-600">Monto:</span>
              <span className="font-medium">
                {formatCurrency(Number(installment.amount), currency)}
              </span>
            </div>
            {installment.paidAmount && (
              <div className="flex justify-between text-sm">
                <span className="text-default-600">Pagado:</span>
                <span className="font-medium text-success">
                  {formatCurrency(Number(installment.paidAmount), currency)}
                </span>
              </div>
            )}
            {installment.capitalAmount && (
              <div className="flex justify-between text-sm">
                <span className="text-default-600">Capital:</span>
                <span className="font-medium">
                  {formatCurrency(Number(installment.capitalAmount), currency)}
                </span>
              </div>
            )}
            {installment.interestAmount && (
              <div className="flex justify-between text-sm">
                <span className="text-default-600">Interés:</span>
                <span className="font-medium">
                  {formatCurrency(Number(installment.interestAmount), currency)}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Marcar como pagada</span>
            <Switch
              isSelected={isPaid}
              onChange={async () => {
                // TODO: Implementar mutation para pagar cuota
                // await payInstallmentMutation.mutateAsync({
                //   creditId: creditId,
                //   installmentNumber: installment.installmentNumber,
                // });
              }}
              isDisabled={isPaid}
            />
          </div>
        </div>
      </Disclosure.Content>
    </Disclosure>
  );
}
