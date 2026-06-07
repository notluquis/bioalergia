import { formatChile } from "@/lib/dates";
import { Button, Card, Chip, Meter } from "@heroui/react";

import type { LoanSummary } from "../types";

interface LoanListProps {
  readonly canManage: boolean;
  readonly loans: LoanSummary[];
  readonly onCreateRequest: () => void;
  readonly onSelect: (publicId: string) => void;
  readonly selectedId: null | string;
}

export function LoanList({
  canManage,
  loans,
  onCreateRequest,
  onSelect,
  selectedId,
}: LoanListProps) {
  const totalRemaining = loans.reduce((sum, loan) => sum + loan.remaining_amount, 0);
  const activeLoans = loans.filter((loan) => loan.status === "ACTIVE").length;

  return (
    <Card className="flex h-full min-h-0 flex-col border-default-200 bg-background shadow-sm">
      <Card.Header className="gap-4 px-5 pt-5 pb-3">
        <div className="min-w-0 flex-1">
          <Card.Title className="font-semibold text-base text-foreground">Préstamos</Card.Title>
          <Card.Description className="text-default-500 text-xs">
            Capital, avance y beneficiarios en curso.
          </Card.Description>
        </div>
        {canManage && (
          <Button onPress={onCreateRequest} size="sm" type="button" variant="primary">
            Nuevo préstamo
          </Button>
        )}
      </Card.Header>

      <Card.Content className="flex min-h-0 flex-1 flex-col gap-4 px-5 pb-5">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-default-200 bg-default-50 px-3 py-2">
            <p className="text-default-500 text-xs">Saldo total</p>
            <p className="font-semibold text-foreground text-sm">
              ${totalRemaining.toLocaleString("es-CL")}
            </p>
          </div>
          <div className="rounded-lg border border-default-200 bg-default-50 px-3 py-2">
            <p className="text-default-500 text-xs">Activos</p>
            <p className="font-semibold text-foreground text-sm">{activeLoans}</p>
          </div>
        </div>

        <div className="muted-scrollbar min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
          {loans.map((loan) => {
            const isActive = loan.public_id === selectedId;
            const paidRatio = loan.total_expected > 0 ? loan.total_paid / loan.total_expected : 0;
            const beneficiaryName = loan.counterpart?.bankAccountHolder ?? loan.borrower_name;
            const beneficiaryDetail = loan.counterpart
              ? loan.counterpart.identificationNumber
              : loan.borrower_type === "PERSON"
                ? "Persona"
                : "Empresa";
            const indicatorColors = {
              ACTIVE: "bg-warning",
              COMPLETED: "bg-success",
              DEFAULTED: "bg-danger",
            };
            const indicatorColor = indicatorColors[loan.status];
            const statusLabel = {
              ACTIVE: "Activo",
              COMPLETED: "Liquidado",
              DEFAULTED: "Mora",
            }[loan.status];
            const progressValue = Math.min(100, Math.round(paidRatio * 100));

            return (
              <Button
                className={`h-auto w-full justify-start rounded-xl border p-3 text-left transition-colors ${
                  isActive
                    ? "border-primary/40 bg-primary/10 text-foreground shadow-sm"
                    : "border-default-200 bg-background text-foreground hover:border-default-300 hover:bg-default-50"
                }`}
                key={loan.public_id}
                onPress={() => {
                  onSelect(loan.public_id);
                }}
                type="button"
                variant="outline"
              >
                <div className="w-full space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-sm tracking-tight">{loan.title}</p>
                      <p className="truncate text-default-500 text-xs">
                        {beneficiaryName} · {beneficiaryDetail}
                      </p>
                    </div>
                    <Chip className="shrink-0" size="sm" variant="soft">
                      <span
                        aria-hidden="true"
                        className={`mr-1 inline-block rounded-full size-2 ${indicatorColor}`}
                      />
                      {statusLabel}
                    </Chip>
                  </div>

                  <div className="grid grid-cols-[1fr_auto] items-end gap-3">
                    <div className="min-w-0">
                      <p className="text-default-500 text-xs">Saldo</p>
                      <p className="font-semibold text-foreground text-sm">
                        ${loan.remaining_amount.toLocaleString("es-CL")}
                      </p>
                    </div>
                    <p className="text-right text-default-500 text-xs">
                      {loan.paid_installments}/{loan.total_installments} cuotas
                    </p>
                  </div>

                  <Meter
                    aria-label={`Préstamo pagado ${progressValue}%`}
                    className="w-full"
                    value={progressValue}
                  >
                    <Meter.Track className="h-2 rounded-full bg-default-100">
                      <Meter.Fill className="bg-primary" />
                    </Meter.Track>
                  </Meter>

                  <p className="text-default-500 text-xs">
                    Inicio {formatChile(loan.start_date, "DD MMM YYYY")}
                  </p>
                </div>
              </Button>
            );
          })}
          {loans.length === 0 && (
            <p className="rounded-xl border border-default-200 border-dashed bg-default-50 p-4 text-default-500 text-xs">
              Aún no registras préstamos. Crea el primero para comenzar a seguir cuotas y pagos.
            </p>
          )}
        </div>
      </Card.Content>
    </Card>
  );
}
