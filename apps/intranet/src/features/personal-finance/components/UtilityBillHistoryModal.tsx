import { Button, Chip, Modal } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { TrendingDownIcon, TrendingUpIcon } from "lucide-react";

import { toUtilityBillsError, utilityBillsClient } from "../utility-bills-orpc";

interface Props {
  accountId: number;
  accountLabel: string;
  onClose: () => void;
}

function formatCLP(value: null | number): string {
  if (value === null) return "—";
  return new Intl.NumberFormat("es-CL", {
    currency: "CLP",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

export function UtilityBillHistoryModal({ accountId, accountLabel, onClose }: Props) {
  const query = useQuery({
    queryFn: () => utilityBillsClient.listSnapshots({ limit: 48, utilityAccountId: accountId }),
    queryKey: ["utility-bills", "snapshots", accountId],
  });

  const snapshots = query.data?.snapshots ?? [];

  // Compute deltas vs previous snapshot
  const withDelta = snapshots.map((s, i) => {
    const prev = snapshots[i + 1];
    const delta =
      prev && s.currentAmount !== null && prev.currentAmount !== null
        ? s.currentAmount - prev.currentAmount
        : null;
    return { ...s, delta };
  });

  return (
    <Modal isOpen onOpenChange={(open) => !open && onClose()}>
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-4xl">
            <Modal.CloseTrigger />
            <Modal.Header>
              <div>
                <Modal.Heading>Historial de boletas — {accountLabel}</Modal.Heading>
                <p className="text-default-500 text-sm">
                  {snapshots.length} snapshots · diferencia vs boleta anterior
                </p>
              </div>
            </Modal.Header>

            <Modal.Body>
              <div className="max-h-[60vh] overflow-auto rounded-xl border border-default-200">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-default-50">
                    <tr className="text-left text-default-600">
                      <th className="px-3 py-2">Fetched</th>
                      <th className="px-3 py-2">Emisión</th>
                      <th className="px-3 py-2 text-right">Actual</th>
                      <th className="px-3 py-2 text-right">Anterior</th>
                      <th className="px-3 py-2 text-right">Δ</th>
                      <th className="px-3 py-2 text-right">Deuda</th>
                      <th className="px-3 py-2">Fuente</th>
                    </tr>
                  </thead>
                  <tbody>
                    {query.isLoading ? (
                      <tr>
                        <td className="px-3 py-6 text-center text-default-400" colSpan={7}>
                          Cargando…
                        </td>
                      </tr>
                    ) : query.isError ? (
                      <tr>
                        <td className="px-3 py-6 text-center text-danger" colSpan={7}>
                          {toUtilityBillsError(query.error).message}
                        </td>
                      </tr>
                    ) : snapshots.length === 0 ? (
                      <tr>
                        <td className="px-3 py-6 text-center text-default-400" colSpan={7}>
                          Sin historial. Refrescá la cuenta para crear el primer snapshot.
                        </td>
                      </tr>
                    ) : (
                      withDelta.map((s) => {
                        const deltaPct =
                          s.delta !== null && s.previousAmount && s.previousAmount > 0
                            ? (s.delta / s.previousAmount) * 100
                            : null;
                        return (
                          <tr className="border-default-100 border-t" key={s.id}>
                            <td className="px-3 py-2 text-default-500 text-xs">
                              {dayjs(s.fetchedAt).format("DD MMM YY HH:mm")}
                            </td>
                            <td className="px-3 py-2 text-default-500 text-xs">
                              {s.emissionDate ?? "—"}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {formatCLP(s.currentAmount)}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-default-500">
                              {formatCLP(s.previousAmount)}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {s.delta === null ? (
                                <span className="text-default-400">—</span>
                              ) : (
                                <span
                                  className={`inline-flex items-center gap-1 ${
                                    s.delta > 0
                                      ? "text-danger"
                                      : s.delta < 0
                                        ? "text-success"
                                        : "text-default-500"
                                  }`}
                                >
                                  {s.delta > 0 ? (
                                    <TrendingUpIcon className="size-3" />
                                  ) : s.delta < 0 ? (
                                    <TrendingDownIcon className="size-3" />
                                  ) : null}
                                  {formatCLP(s.delta)}
                                  {deltaPct !== null && (
                                    <span className="text-xs opacity-70">
                                      ({deltaPct > 0 ? "+" : ""}
                                      {deltaPct.toFixed(0)}%)
                                    </span>
                                  )}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-default-500">
                              {formatCLP(s.currentDebt)}
                            </td>
                            <td className="px-3 py-2">
                              <Chip size="sm" variant="soft">
                                {s.source}
                              </Chip>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end pt-3">
                <Button variant="outline" onPress={onClose}>
                  Cerrar
                </Button>
              </div>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
