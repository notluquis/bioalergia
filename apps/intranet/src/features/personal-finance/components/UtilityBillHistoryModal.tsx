import { Button, Chip, Modal } from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { DownloadIcon, TrendingDownIcon, TrendingUpIcon } from "lucide-react";

import type { UtilityProvider } from "@finanzas/orpc-contracts/utility-bills";

import { toast } from "@/lib/toast-interceptor";

import { toUtilityBillsError, utilityBillsClient } from "../utility-bills-orpc";

interface Props {
  accountId: number;
  accountLabel: string;
  canImportEssbio: boolean;
  onClose: () => void;
  provider: UtilityProvider;
}

const CONSUMO_UNIT: Partial<Record<UtilityProvider, string>> = {
  CGE: "kWh",
  ESSBIO: "m³",
};

const COL_COUNT = 9;

function formatCLP(value: null | number | undefined): string {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("es-CL", {
    currency: "CLP",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

export function UtilityBillHistoryModal({
  accountId,
  accountLabel,
  canImportEssbio,
  onClose,
  provider,
}: Props) {
  const queryClient = useQueryClient();
  const snapshotsKey = ["utility-bills", "snapshots", accountId];

  const query = useQuery({
    queryFn: () => utilityBillsClient.listSnapshots({ limit: 48, utilityAccountId: accountId }),
    queryKey: snapshotsKey,
  });

  const isCge = provider === "CGE";

  const importMutation = useMutation({
    mutationFn: () =>
      isCge
        ? utilityBillsClient.importCgeConsumo({ id: accountId })
        : utilityBillsClient.importEssbioHistory({ id: accountId }),
    onError: (err) => toast.error(toUtilityBillsError(err).message),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: snapshotsKey });
      toast.success(
        `Historial: ${res.imported} nuevas, ${res.skipped} ya existían (${res.total} total)`
      );
    },
  });

  // CGE no requiere externalAccountId; basta credencial Cognito (server-side)
  const canImport = isCge || canImportEssbio;

  const snapshots = query.data?.snapshots ?? [];

  // Delta vs snapshot anterior (lista ordenada desc por fetchedAt)
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
          <Modal.Dialog className="sm:max-w-5xl">
            <Modal.CloseTrigger />
            <Modal.Header>
              <div className="flex w-full items-start justify-between gap-3">
                <div>
                  <Modal.Heading>Historial de boletas — {accountLabel}</Modal.Heading>
                  <p className="text-default-500 text-sm">
                    {snapshots.length} registros · {provider}
                  </p>
                </div>
                {canImport && (
                  <Button
                    size="sm"
                    variant="primary"
                    isDisabled={importMutation.isPending}
                    onPress={() => importMutation.mutate()}
                  >
                    <DownloadIcon className="size-4" aria-hidden="true" />
                    {importMutation.isPending
                      ? "Importando…"
                      : isCge
                        ? "Importar consumo CGE"
                        : "Importar historial Essbio"}
                  </Button>
                )}
              </div>
            </Modal.Header>

            <Modal.Body>
              {provider === "ESSBIO" && !canImportEssbio && (
                <div className="rounded-lg border border-warning-200 bg-warning-50 px-3 py-2 text-warning-700 text-xs">
                  Falta el <b>ID servicio Essbio</b> (idservicio) en la cuenta para importar
                  historial. Editá la cuenta y agregalo.
                </div>
              )}

              <div className="max-h-[60vh] overflow-auto rounded-xl border border-default-200">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-default-50">
                    <tr className="text-left text-default-600">
                      <th className="px-3 py-2">Periodo</th>
                      <th className="px-3 py-2">Emisión</th>
                      <th className="px-3 py-2">Corte</th>
                      <th className="px-3 py-2 text-right">Total</th>
                      <th className="px-3 py-2 text-right">Δ</th>
                      <th className="px-3 py-2 text-right">
                        Consumo {CONSUMO_UNIT[provider] ?? ""}
                      </th>
                      <th className="px-3 py-2 text-right">Lectura</th>
                      <th className="px-3 py-2">Folio</th>
                      <th className="px-3 py-2">Fuente</th>
                    </tr>
                  </thead>
                  <tbody>
                    {query.isLoading ? (
                      <tr>
                        <td className="px-3 py-6 text-center text-default-400" colSpan={COL_COUNT}>
                          Cargando…
                        </td>
                      </tr>
                    ) : query.isError ? (
                      <tr>
                        <td className="px-3 py-6 text-center text-danger" colSpan={COL_COUNT}>
                          {toUtilityBillsError(query.error).message}
                        </td>
                      </tr>
                    ) : snapshots.length === 0 ? (
                      <tr>
                        <td className="px-3 py-6 text-center text-default-400" colSpan={COL_COUNT}>
                          Sin historial. Importá el historial Essbio o refrescá la cuenta.
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
                            <td className="px-3 py-2 font-medium">
                              {s.period ?? (
                                <span className="text-default-400 text-xs">
                                  {dayjs(s.fetchedAt).format("DD MMM YY")}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-default-500 text-xs">
                              {s.emissionDate ?? "—"}
                            </td>
                            <td className="px-3 py-2 text-default-500 text-xs">
                              {s.dueDate ?? "—"}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {formatCLP(s.currentAmount)}
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
                                    <TrendingUpIcon className="size-3" aria-hidden="true" />
                                  ) : s.delta < 0 ? (
                                    <TrendingDownIcon className="size-3" aria-hidden="true" />
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
                            <td className="px-3 py-2 text-right tabular-nums text-default-600">
                              {s.consumption ?? "—"}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-default-500">
                              {s.reading ?? "—"}
                            </td>
                            <td className="px-3 py-2 text-default-400 text-xs">{s.folio ?? "—"}</td>
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
