import { Card, DateField, DateRangePicker, Label, ListBox, Select } from "@heroui/react";
import { parseDate } from "@internationalized/date";
import { DataTable } from "@/components/data-table/DataTable";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { DateRangeCalendar } from "@/components/ui/DateRangeCalendar";
import { Input } from "@/components/ui/Input";
import {
  getCounterpartsColumns,
  getLeaderboardColumns,
  getMonthlyColumns,
} from "@/features/participants/components/ParticipantColumns";
import { useParticipantInsightsData } from "@/features/participants/hooks/use-participant-insights-data";
import { PAGE_CONTAINER } from "@/lib/styles";
export function ParticipantInsightsPage() {
  const {
    counterparts,
    detailError,
    detailLoading,
    displayedLeaderboard,
    from,
    handleSelectParticipant,
    handleSubmit,
    leaderboardError,
    leaderboardGrouping,
    leaderboardLimit,
    leaderboardLoading,
    monthly,
    participantId,
    quickMonth,
    quickMonthOptions,
    setFrom,
    setLeaderboardGrouping,
    setLeaderboardLimit,
    setParticipantId,
    setQuickMonth,
    setTo,
    to,
    visible,
  } = useParticipantInsightsData();

  const leaderboardColumns = getLeaderboardColumns();
  const monthlyColumns = getMonthlyColumns();
  const counterpartsColumns = getCounterpartsColumns();

  return (
    <section className={PAGE_CONTAINER}>
      <Card>
        <Card.Content className="p-6">
          <form
            className="grid items-end gap-6 sm:grid-cols-2 lg:grid-cols-4"
            onSubmit={handleSubmit}
          >
            <Input
              enterKeyHint="search"
              inputMode="numeric"
              label="ID participante"
              onChange={(e) => {
                setParticipantId(e.target.value);
              }}
              placeholder="123861706983"
              type="text"
              value={participantId}
            />

            <Select
              onChange={(value) => {
                setQuickMonth(value as string);
              }}
              value={quickMonth}
            >
              <Label>Rango rápido</Label>
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {quickMonthOptions.map((option) => (
                    <ListBox.Item id={option.value} key={option.value}>
                      {option.label}
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
            <DateRangePicker
              isDisabled={quickMonth !== "custom"}
              onChange={(value) => {
                if (!value) {
                  return;
                }
                setFrom(value.start.toString());
                setTo(value.end.toString());
              }}
              value={from && to ? { end: parseDate(to), start: parseDate(from) } : undefined}
            >
              <Label>Rango personalizado</Label>
              <DateField.Group>
                <DateField.Input slot="start">
                  {(segment) => <DateField.Segment segment={segment} />}
                </DateField.Input>
                <DateRangePicker.RangeSeparator />
                <DateField.Input slot="end">
                  {(segment) => <DateField.Segment segment={segment} />}
                </DateField.Input>
                <DateField.Suffix>
                  <DateRangePicker.Trigger>
                    <DateRangePicker.TriggerIndicator />
                  </DateRangePicker.Trigger>
                </DateField.Suffix>
              </DateField.Group>
              <DateRangePicker.Popover>
                <DateRangeCalendar visibleDuration={{ months: 2 }} />
              </DateRangePicker.Popover>
            </DateRangePicker>

            <div className="flex justify-end lg:col-span-4">
              <Button disabled={detailLoading} isLoading={detailLoading} type="submit">
                Consultar
              </Button>
            </div>
          </form>
        </Card.Content>
      </Card>

      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <h2 className="font-semibold text-lg">Ranking de retiros</h2>
            <p className="text-default-600 text-sm">
              Contrapartes con mayores egresos en el rango seleccionado.
            </p>
          </div>
          <div className="flex flex-wrap gap-4">
            <div className="w-32">
              <Select
                className="select-sm"
                onChange={(val) => {
                  const value = Number(val);
                  setLeaderboardLimit(Number.isFinite(value) ? value : 10);
                }}
                value={String(leaderboardLimit)}
              >
                <Label>Mostrar top</Label>
                <Select.Trigger>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    {[10, 20, 30].map((value) => (
                      <ListBox.Item id={String(value)} key={value}>
                        {value}
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>
            </div>
            <div className="w-44">
              <Select
                className="select-sm"
                onChange={(val) => {
                  setLeaderboardGrouping(val as "account" | "rut");
                }}
                value={leaderboardGrouping}
              >
                <Label>Agrupar por</Label>
                <Select.Trigger>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    <ListBox.Item id="account">Cuenta bancaria</ListBox.Item>
                    <ListBox.Item id="rut">RUT</ListBox.Item>
                  </ListBox>
                </Select.Popover>
              </Select>
            </div>
          </div>
        </div>

        {leaderboardError && <Alert status="danger">{leaderboardError}</Alert>}

        <Card>
          <Card.Content className="p-0">
            <DataTable
              columns={leaderboardColumns}
              data={displayedLeaderboard}
              containerVariant="plain"
              isLoading={leaderboardLoading}
              meta={
                {
                  detailLoading,
                  onSelect: handleSelectParticipant,
                  participantId,
                } as unknown as Record<string, unknown>
              }
              noDataMessage={
                leaderboardLoading
                  ? "Cargando ranking..."
                  : "Sin participantes en el rango seleccionado."
              }
              scrollMaxHeight="min(68dvh, 760px)"
            />
          </Card.Content>
        </Card>
      </div>

      {detailError && <Alert status="danger">{detailError}</Alert>}

      {visible ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="space-y-4">
            <h2 className="font-semibold text-lg">Resumen mensual</h2>
            <Card>
              <Card.Content className="p-0">
                <DataTable
                  columns={monthlyColumns}
                  data={monthly}
                  enableToolbar={false}
                  containerVariant="plain"
                  isLoading={detailLoading}
                  noDataMessage="Sin movimientos."
                  scrollMaxHeight="min(48dvh, 560px)"
                />
              </Card.Content>
            </Card>
          </section>

          <section className="space-y-4">
            <h2 className="font-semibold text-lg">Contrapartes</h2>
            <Card>
              <Card.Content className="p-0">
                <DataTable
                  columns={counterpartsColumns}
                  data={counterparts}
                  enableToolbar={false}
                  containerVariant="plain"
                  isLoading={detailLoading}
                  noDataMessage="No hay contrapartes."
                  scrollMaxHeight="min(48dvh, 560px)"
                />
              </Card.Content>
            </Card>
          </section>
        </div>
      ) : (
        <div className="py-12 text-center text-default-400">
          {detailLoading
            ? "Buscando información del participante..."
            : "Ingresa un identificador y selecciona el rango para ver su actividad."}
        </div>
      )}
    </section>
  );
}
