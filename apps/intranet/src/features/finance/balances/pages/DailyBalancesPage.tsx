import {
  Alert,
  Button,
  Card,
  DateField,
  DateRangePicker,
  Label,
  ListBox,
  RangeCalendar,
  Select,
} from "@heroui/react";
import { parseDate } from "@internationalized/date";
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
export function DailyBalances() {
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
      const dateKey = dayjs(day.date, "YYYY-MM-DD").format("YYYY-MM-DD");
      nextDrafts[dateKey] = {
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
          {derivedInitial != null && (
            <p className="text-default-500 text-sm">
              Saldo anterior: <strong>{formatBalanceInput(derivedInitial)}</strong>
            </p>
          )}

          <Card>
            <Card.Content>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-[1fr_1fr_1fr_auto]">
                <DateRangePicker
                  className="w-full"
                  onChange={(value) => {
                    if (!value) {
                      return;
                    }
                    setFrom(value.start.toString());
                    setTo(value.end.toString());
                  }}
                  value={from && to ? { end: parseDate(to), start: parseDate(from) } : undefined}
                >
                  <Label>Rango de fechas</Label>
                  <DateField.Group>
                    <DateField.InputContainer>
                      <DateField.Input slot="start">
                        {(segment) => <DateField.Segment segment={segment} />}
                      </DateField.Input>
                      <DateRangePicker.RangeSeparator />
                      <DateField.Input slot="end">
                        {(segment) => <DateField.Segment segment={segment} />}
                      </DateField.Input>
                    </DateField.InputContainer>
                    <DateField.Suffix>
                      <DateRangePicker.Trigger>
                        <DateRangePicker.TriggerIndicator />
                      </DateRangePicker.Trigger>
                    </DateField.Suffix>
                  </DateField.Group>
                  <DateRangePicker.Popover>
                    <RangeCalendar visibleDuration={{ months: 2 }}>
                      <RangeCalendar.Header>
                        <RangeCalendar.Heading />
                        <RangeCalendar.NavButton slot="previous" />
                        <RangeCalendar.NavButton slot="next" />
                      </RangeCalendar.Header>
                      <RangeCalendar.Grid>
                        <RangeCalendar.GridHeader>
                          {(day) => <RangeCalendar.HeaderCell>{day}</RangeCalendar.HeaderCell>}
                        </RangeCalendar.GridHeader>
                        <RangeCalendar.GridBody>
                          {(date) => <RangeCalendar.Cell date={date} />}
                        </RangeCalendar.GridBody>
                      </RangeCalendar.Grid>
                    </RangeCalendar>
                  </DateRangePicker.Popover>
                </DateRangePicker>
                <Select
                  className="w-full"
                  value={quickRange}
                  onChange={(key) => {
                    const value = key as string;
                    if (value === "custom") {
                      return;
                    }
                    const match = quickMonths.find((month) => month.value === value);
                    if (!match) {
                      return;
                    }
                    setFrom(match.from);
                    setTo(match.to);
                  }}
                >
                  <Label>Mes rápido</Label>
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      <ListBox.Item id="custom" textValue="Personalizado">
                        Personalizado
                      </ListBox.Item>
                      {quickMonths.map((month) => (
                        <ListBox.Item id={month.value} key={month.value} textValue={month.label}>
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
        <Alert status="danger">No tienes permisos para ver los saldos diarios.</Alert>
      )}
    </section>
  );
}
