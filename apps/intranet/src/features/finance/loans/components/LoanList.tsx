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
    <Card className="flex h-full min-h-[24rem] flex-col overflow-hidden border-default-200 bg-background shadow-sm">
      <Card.Header className="items-start gap-3 p-4">
        <div className="min-w-0 flex-1">
          <Card.Title className="font-semibold text-base text-foreground">Préstamos</Card.Title>
          <Card.Description className="text-default-500 text-xs">
            Capital, avance y beneficiarios en curso.
          </Card.Description>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
            <span className="text-default-500">
              Saldo{" "}
              <strong className="font-semibold text-foreground">
                ${totalRemaining.toLocaleString("es-CL")}
              </strong>
            </span>
            <span className="text-default-500">
              Activos <strong className="font-semibold text-foreground">{activeLoans}</strong>
            </span>
          </div>
        </div>
        {canManage && (
          <Button onPress={onCreateRequest} size="sm" type="button" variant="primary">
            Nuevo
          </Button>
        )}
      </Card.Header>

      <Card.Content className="min-h-0 flex-1 p-0">
        {loans.length === 0 ? (
          <p className="m-4 rounded-lg border border-default-200 border-dashed bg-default-50 p-4 text-default-500 text-xs">
            Aún no registras préstamos. Crea el primero para comenzar a seguir cuotas y pagos.
          </p>
        ) : (
          <div className="muted-scrollbar min-h-0 flex-1 overflow-y-auto px-3 pb-3">
            <div className="space-y-2">
              {loans.map((loan) => {
                const isActive = loan.public_id === selectedId;
                const paidRatio =
                  loan.total_expected > 0 ? loan.total_paid / loan.total_expected : 0;
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
                const statusColor = {
                  ACTIVE: "warning",
                  COMPLETED: "success",
                  DEFAULTED: "danger",
                }[loan.status] as "danger" | "success" | "warning";
                const progressValue = Math.min(100, Math.round(paidRatio * 100));

                return (
                  <Button
                    className={`h-auto w-full justify-start text-left p-3 ${
                      isActive ? "border-primary bg-primary/10" : "border-default-200 bg-default-50"
                    }`}
                    key={loan.public_id}
                    onPress={() => {
                      onSelect(loan.public_id);
                    }}
                    type="button"
                    variant="outline"
                  >
                    <span className="grid w-full min-w-0 gap-2">
                      <span className="flex min-w-0 items-start justify-between gap-3">
                        <span className="min-w-0">
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="truncate font-semibold text-sm">{loan.title}</span>
                            <span
                              aria-hidden="true"
                              className={`shrink-0 rounded-full size-2 ${indicatorColor}`}
                            />
                          </span>
                          <span className="block truncate text-default-500 text-xs">
                            {beneficiaryName} · {beneficiaryDetail}
                          </span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span className="block font-semibold text-sm tabular-nums">
                            ${loan.remaining_amount.toLocaleString("es-CL")}
                          </span>
                          <Chip color={statusColor} size="sm" variant="soft">
                            {statusLabel}
                          </Chip>
                        </span>
                      </span>
                      <span className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                        <Meter
                          aria-label={`Préstamo pagado ${progressValue}%`}
                          value={progressValue}
                        >
                          <Meter.Track className="h-1.5 rounded-full bg-background">
                            <Meter.Fill className="bg-primary" />
                          </Meter.Track>
                        </Meter>
                        <span className="text-default-500 text-xs tabular-nums">
                          {loan.paid_installments}/{loan.total_installments}
                        </span>
                      </span>
                      <span className="text-default-400 text-xs">
                        Inicio {formatChile(loan.start_date, "DD MMM YYYY")}
                      </span>
                    </span>
                  </Button>
                );
              })}
            </div>
          </div>
        )}
      </Card.Content>
    </Card>
  );
}
