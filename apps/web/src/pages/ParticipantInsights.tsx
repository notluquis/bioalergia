import { DataTable } from "@/components/data-table/DataTable";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import { Select, SelectItem } from "@/components/ui/Select";
import {
  getCounterpartsColumns,
  getLeaderboardColumns,
  getMonthlyColumns,
} from "@/features/participants/components/ParticipantColumns";
import { useParticipantInsightsData } from "@/features/participants/hooks/use-participant-insights-data";
import { PAGE_CONTAINER } from "@/lib/styles";

export default function ParticipantInsightsPage() {
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
  // const counterpartsColumns = getCounterpartsColumns(); // Removed as it was unused in logic but used in render?
  // Wait, counterpartsColumns IS used in render at line 197.
  // Lint error said "Several of these imports are unused" at line 4 (CardTitle etc).
  // AND "getCounterpartsColumns" at line 8 was likely unused?
  // Actually, let's keep it if used.
  // The lint was about `CardTitle`, `CardDescription`.
  // I will focus on replacing Imports to clean up unused UI components.
  const counterpartsColumns = getCounterpartsColumns();

  return (
    <section className={PAGE_CONTAINER}>
      <Card>
        <CardContent className="p-6">
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
              label="Rango rápido"
              onChange={(value) => {
                setQuickMonth(value as string);
              }}
              value={quickMonth}
            >
              {quickMonthOptions.map((option) => (
                <SelectItem key={option.value}>{option.label}</SelectItem>
              ))}
            </Select>
            <Input
              disabled={quickMonth !== "custom"}
              label="Desde"
              onChange={(e) => {
                setFrom(e.target.value);
              }}
              type="date"
              value={from}
            />
            <Input
              disabled={quickMonth !== "custom"}
              label="Hasta"
              onChange={(e) => {
                setTo(e.target.value);
              }}
              type="date"
              value={to}
            />
            <div className="flex justify-end lg:col-span-4">
              <Button disabled={detailLoading} isLoading={detailLoading} type="submit">
                Consultar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Ranking de retiros</h2>
            <p className="text-default-600 text-sm">
              Contrapartes con mayores egresos en el rango seleccionado.
            </p>
          </div>
          <div className="flex flex-wrap gap-4">
            <div className="w-32">
              <Select
                className="select-sm"
                label="Mostrar top"
                onChange={(val) => {
                  const value = Number(val);
                  setLeaderboardLimit(Number.isFinite(value) ? value : 10);
                }}
                value={String(leaderboardLimit)}
              >
                {[10, 20, 30].map((value) => (
                  <SelectItem key={value}>{value}</SelectItem>
                ))}
              </Select>
            </div>
            <div className="w-44">
              <Select
                className="select-sm"
                label="Agrupar por"
                onChange={(val) => {
                  setLeaderboardGrouping(val as "account" | "rut");
                }}
                value={leaderboardGrouping}
              >
                <SelectItem key="account">Cuenta bancaria</SelectItem>
                <SelectItem key="rut">RUT</SelectItem>
              </Select>
            </div>
          </div>
        </div>

        {leaderboardError && <Alert variant="error">{leaderboardError}</Alert>}

        <Card>
          <CardContent className="p-0">
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
            />
          </CardContent>
        </Card>
      </div>

      {detailError && <Alert variant="error">{detailError}</Alert>}

      {visible ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Resumen mensual</h2>
            <Card>
              <CardContent className="p-0">
                <DataTable
                  columns={monthlyColumns}
                  data={monthly}
                  enableToolbar={false}
                  containerVariant="plain"
                  isLoading={detailLoading}
                  noDataMessage="Sin movimientos."
                />
              </CardContent>
            </Card>
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Contrapartes</h2>
            <Card>
              <CardContent className="p-0">
                <DataTable
                  columns={counterpartsColumns}
                  data={counterparts}
                  enableToolbar={false}
                  containerVariant="plain"
                  isLoading={detailLoading}
                  noDataMessage="No hay contrapartes."
                />
              </CardContent>
            </Card>
          </section>
        </div>
      ) : (
        <div className="text-default-400 py-12 text-center">
          {detailLoading
            ? "Buscando información del participante..."
            : "Ingresa un identificador y selecciona el rango para ver su actividad."}
        </div>
      )}
    </section>
  );
}
