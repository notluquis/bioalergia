import { Button, Chip, ListBox, Select } from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { CheckIcon, LinkIcon, RefreshCwIcon, SettingsIcon, SparklesIcon } from "lucide-react";
import { useState } from "react";

import type { ExpenseScope, ExpenseStatus } from "@finanzas/orpc-contracts/expenses";
import { dteSyncORPCClient } from "@/features/settings/dte-sync-orpc";
import { toast } from "@/lib/toast-interceptor";

import { expensesORPCClient, toExpensesApiError } from "../expenses-orpc";
import { ExpenseLinkModal } from "./ExpenseLinkModal";
import { ExpenseServicesModal } from "./ExpenseServicesModal";

const STATUS_COLORS: Record<ExpenseStatus, "default" | "success" | "warning" | "danger"> = {
  OVERDUE: "danger",
  PAID: "success",
  PENDING: "warning",
  SKIPPED: "default",
};

const SCOPE_LABELS: Record<ExpenseScope, string> = {
  BIOALERGIA: "Clínica",
  PERSONAL: "Personal",
};

const STATUS_LABELS: Record<ExpenseStatus, string> = {
  OVERDUE: "Vencido",
  PAID: "Pagado",
  PENDING: "Pendiente",
  SKIPPED: "Omitido",
};

function formatCLP(value: number): string {
  return new Intl.NumberFormat("es-CL", {
    currency: "CLP",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

export function ExpensesPanel() {
  const queryClient = useQueryClient();
  const [scope, setScope] = useState<"all" | ExpenseScope>("BIOALERGIA");
  const [month, setMonth] = useState(() => dayjs().format("YYYY-MM"));
  const [linkTarget, setLinkTarget] = useState<null | {
    expectedAmount: number;
    name: string;
    publicId: string;
    scope: ExpenseScope;
  }>(null);
  const [servicesModalOpen, setServicesModalOpen] = useState(false);

  const monthStart = `${month}-01`;
  const monthEnd = dayjs(monthStart).endOf("month").format("YYYY-MM-DD");

  const expensesQuery = useQuery({
    queryFn: () =>
      expensesORPCClient.list({
        from: monthStart,
        scope: scope === "all" ? undefined : scope,
        to: monthEnd,
      }),
    queryKey: ["expenses", "list", scope, month],
  });

  const statsQuery = useQuery({
    queryFn: () =>
      expensesORPCClient.stats({
        from: monthStart,
        groupBy: "month",
        scope: scope === "all" ? undefined : scope,
        to: monthEnd,
      }),
    queryKey: ["expenses", "stats", scope, month],
  });

  const generateMutation = useMutation({
    mutationFn: (m: string) => expensesORPCClient.generateFromTemplates({ month: m }),
    onError: (err) => toast.error(toExpensesApiError(err).message),
    onSuccess: (data) => {
      toast.success(`Generados ${data.created} gastos del mes`);
      void queryClient.invalidateQueries({ queryKey: ["expenses"] });
    },
  });

  const reconcileMutation = useMutation({
    mutationFn: () => dteSyncORPCClient.reconcileUnmatched({ daysBack: 180, limit: 1000 }),
    onError: (err) => {
      const msg = err instanceof Error ? err.message : "Error";
      toast.error(`Reconciliación falló: ${msg}`);
    },
    onSuccess: (data) => {
      const s = data.summary;
      toast.success(
        `Reconciliado ${s.total} DTEs · ${s.createdExpense} expense creados · ${s.linkedExisting} linkeados · ${s.noMatch} sin match`
      );
      void queryClient.invalidateQueries({ queryKey: ["expenses"] });
    },
  });

  const expenses = expensesQuery.data?.expenses ?? [];
  const stats = statsQuery.data?.stats?.[0] ?? null;

  const pendingCount = expenses.filter((e) => e.status === "PENDING").length;
  const overdueCount = expenses.filter((e) => e.status === "OVERDUE").length;
  const paidCount = expenses.filter((e) => e.status === "PAID").length;

  const monthOptions: { label: string; value: string }[] = [];
  for (let i = -6; i <= 3; i++) {
    const d = dayjs().add(i, "month");
    monthOptions.push({ label: d.format("MMM YYYY"), value: d.format("YYYY-MM") });
  }

  return (
    <div className="space-y-4">
      {/* Header con filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-default-500 text-sm">Mes:</span>
          <Select
            aria-label="Mes"
            className="w-40"
            selectedKey={month}
            onSelectionChange={(key) => key !== null && setMonth(String(key))}
          >
            <ListBox>
              {monthOptions.map((opt) => (
                <ListBox.Item key={opt.value} id={opt.value}>
                  {opt.label}
                </ListBox.Item>
              ))}
            </ListBox>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-default-500 text-sm">Tipo:</span>
          <Select
            aria-label="Scope"
            className="w-36"
            selectedKey={scope}
            onSelectionChange={(key) =>
              key !== null && setScope(String(key) as ExpenseScope | "all")
            }
          >
            <ListBox>
              <ListBox.Item id="BIOALERGIA">Clínica</ListBox.Item>
              <ListBox.Item id="PERSONAL">Personal</ListBox.Item>
              <ListBox.Item id="all">Ambos</ListBox.Item>
            </ListBox>
          </Select>
        </div>

        <div className="ml-auto flex gap-2">
          <Button variant="outline" onPress={() => setServicesModalOpen(true)}>
            <SettingsIcon className="size-4" />
            Plantillas
          </Button>
          <Button
            isDisabled={reconcileMutation.isPending}
            variant="outline"
            onPress={() => reconcileMutation.mutate()}
          >
            <LinkIcon className="size-4" />
            Reconciliar DTE
          </Button>
          <Button
            isDisabled={generateMutation.isPending}
            variant="outline"
            onPress={() => generateMutation.mutate(month)}
          >
            <SparklesIcon className="size-4" />
            Generar mes
          </Button>
          <Button
            variant="outline"
            onPress={() => {
              void queryClient.invalidateQueries({ queryKey: ["expenses"] });
            }}
          >
            <RefreshCwIcon className="size-4" />
            Refrescar
          </Button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Esperado" tone="default" value={formatCLP(stats?.totalExpected ?? 0)} />
        <StatCard label="Pagado" tone="success" value={formatCLP(stats?.totalApplied ?? 0)} />
        <StatCard label="Pendientes" tone="warning" value={`${pendingCount} cuentas`} />
        <StatCard
          label="Vencidos"
          tone={overdueCount > 0 ? "danger" : "default"}
          value={`${overdueCount} cuentas`}
        />
      </div>

      {/* Tabla expenses */}
      <div className="overflow-hidden rounded-2xl border border-default-200 bg-background">
        <table className="w-full text-sm">
          <thead className="bg-default-50">
            <tr className="text-left text-default-600">
              <th className="px-4 py-2">Servicio</th>
              <th className="px-4 py-2">Detalle</th>
              <th className="px-4 py-2">Vencimiento</th>
              <th className="px-4 py-2 text-right">Esperado</th>
              <th className="px-4 py-2 text-right">Pagado</th>
              <th className="px-4 py-2">Estado</th>
              <th className="px-4 py-2">Tipo</th>
              <th className="px-4 py-2">
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {expensesQuery.isLoading ? (
              <tr>
                <td className="px-4 py-8 text-center text-default-400" colSpan={8}>
                  Cargando…
                </td>
              </tr>
            ) : expenses.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-default-400" colSpan={8}>
                  Sin gastos para este mes. ¿Generaste el mes desde plantillas?
                </td>
              </tr>
            ) : (
              expenses.map((e) => (
                <tr className="border-default-100 border-t" key={e.publicId}>
                  <td className="px-4 py-2 font-medium">{e.name}</td>
                  <td className="px-4 py-2 text-default-500">{e.detail ?? "—"}</td>
                  <td className="px-4 py-2 text-default-500">
                    {e.dueDate ? dayjs(e.dueDate).format("DD MMM") : "—"}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {formatCLP(e.amountExpected)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {formatCLP(e.amountApplied)}
                  </td>
                  <td className="px-4 py-2">
                    <Chip color={STATUS_COLORS[e.status]} size="sm" variant="soft">
                      {STATUS_LABELS[e.status]}
                    </Chip>
                  </td>
                  <td className="px-4 py-2 text-default-500 text-xs">{SCOPE_LABELS[e.scope]}</td>
                  <td className="px-4 py-2 text-right">
                    {e.status !== "PAID" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onPress={() =>
                          setLinkTarget({
                            expectedAmount: e.amountExpected,
                            name: e.name,
                            publicId: e.publicId,
                            scope: e.scope,
                          })
                        }
                      >
                        <CheckIcon className="size-3" />
                        Vincular
                      </Button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer notas */}
      <p className="text-default-400 text-xs">
        {expenses.length} gastos · {paidCount} pagados · {pendingCount} pendientes · {overdueCount}{" "}
        vencidos
      </p>

      {linkTarget && (
        <ExpenseLinkModal
          expectedAmount={linkTarget.expectedAmount}
          expenseName={linkTarget.name}
          expensePublicId={linkTarget.publicId}
          scope={linkTarget.scope}
          onClose={() => setLinkTarget(null)}
          onLinked={() => {
            setLinkTarget(null);
            void queryClient.invalidateQueries({ queryKey: ["expenses"] });
          }}
        />
      )}

      {servicesModalOpen && <ExpenseServicesModal onClose={() => setServicesModalOpen(false)} />}
    </div>
  );
}

function StatCard({
  label,
  tone,
  value,
}: {
  label: string;
  tone: "danger" | "default" | "success" | "warning";
  value: string;
}) {
  const toneClass = {
    danger: "border-danger-200 bg-danger-50 text-danger-700",
    default: "border-default-200 bg-default-50 text-default-700",
    success: "border-success-200 bg-success-50 text-success-700",
    warning: "border-warning-200 bg-warning-50 text-warning-700",
  }[tone];

  return (
    <div className={`rounded-2xl border p-4 ${toneClass}`}>
      <p className="text-xs uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-1 font-semibold text-lg tabular-nums">{value}</p>
    </div>
  );
}
