import { Alert, Button, Card, Input, Label, ListBox, Select, TextField } from "@heroui/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { BalanceSummary } from "@/features/finance/balances/components/BalanceSummary";
import { DailyBalancesPanel } from "@/features/finance/balances/components/DailyBalancesPanel";
import { useDailyBalanceManagement } from "@/features/finance/balances/hooks/use-daily-balance-management";
import { useQuickDateRange } from "@/features/finance/balances/hooks/use-quick-date-range";
import { balanceKeys } from "@/features/finance/balances/queries";
import type { BalanceDraft } from "@/features/finance/balances/types";
import { deriveInitialBalance, formatBalanceInput } from "@/features/finance/balances/utils";
import { today } from "@/lib/dates";

export default function DailyBalances() {
  const { can } = useAuth();
  // canEdit flag removed (unused)

  const [from, setFrom] = useState(dayjs().subtract(10, "day").format("YYYY-MM-DD"));
  const [to, setTo] = useState(today());
  const { quickMonths } = useQuickDateRange();

  const quickRange = (() => {
    const match = quickMonths.find((month) => month.from === from && month.to === to);
    return match ? match.value : "custom";
  })();

  const { data: report, isFetching, refetch } = useSuspenseQuery(balanceKeys.range(from, to));

  const balancesError = null; // Suspense handles errors
  const isInitialLoading = false; // Suspense handles loading

  const reloadBalances = async () => {
    await refetch();
  };

  const { drafts, error, handleDraftChange, handleSave, saving, setDrafts } =
    useDailyBalanceManagement({
      loadBalances: reloadBalances,
    });

  useEffect(() => {
    const nextDrafts: Record<string, BalanceDraft> = {};
    for (const day of report.days) {
      nextDrafts[day.date] = {
        note: day.note ?? "",
        value: day.recordedBalance == null ? "" : formatBalanceInput(day.recordedBalance),
      };
    }
    setDrafts(nextDrafts);
  }, [report, setDrafts]);

  const derivedInitial = deriveInitialBalance(report);

  return (
    <section className="space-y-4">
      {can("read", "DailyBalance") ? (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-primary text-xl font-semibold">Saldos diarios</h1>
              {derivedInitial != null && (
                <p className="text-default-500 text-sm">
                  Saldo anterior: <strong>{formatBalanceInput(derivedInitial)}</strong>
                </p>
              )}
            </div>
          </div>

          <Card>
            <Card.Content>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-[1fr_1fr_1fr_auto]">
                <TextField className="w-full">
                  <Label>Desde</Label>
                  <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                </TextField>
                <TextField className="w-full">
                  <Label>Hasta</Label>
                  <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
                </TextField>
                <Select
                  className="w-full"
                  selectedKey={quickRange}
                  onSelectionChange={(key) => {
                    const value = key as string;
                    if (value === "custom") return;
                    const match = quickMonths.find((month) => month.value === value);
                    if (!match) return;
                    setFrom(match.from);
                    setTo(match.to);
                  }}
                >
                  <Label>Mes rápido</Label>
                  <Select.Trigger>
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      <ListBox.Item id="custom" textValue="Personalizado">
                        Personalizado
                      </ListBox.Item>
                      {quickMonths.map((month) => (
                        <ListBox.Item key={month.value} id={month.value} textValue={month.label}>
                          {month.label}
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>
                <div className="flex items-end">
                  <Button
                    className="w-full sm:w-auto"
                    isDisabled={isFetching}
                    onPress={() => refetch()}
                    size="sm"
                    variant="primary"
                  >
                    {isFetching ? "..." : "Actualizar"}
                  </Button>
                </div>
              </div>
            </Card.Content>
          </Card>

          <BalanceSummary error={balancesError} loading={isFetching} report={report} />

          <DailyBalancesPanel
            drafts={drafts}
            error={error}
            loading={isInitialLoading}
            onDraftChange={handleDraftChange}
            onSave={handleSave}
            report={report}
            saving={saving}
          />
        </>
      ) : (
        <Alert color="danger">No tienes permisos para ver los saldos diarios.</Alert>
      )}
    </section>
  );
}
