import { DataTable } from "@/components/data-table/DataTable";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import {
  getCounterpartsColumns,
  getLeaderboardColumns,
  getMonthlyColumns,
  type LeaderboardMeta,
} from "@/features/participants/components/ParticipantColumns";
import { useParticipantInsightsData } from "@/features/participants/hooks/useParticipantInsightsData";
import { PAGE_CONTAINER } from "@/lib/styles";

export default function ParticipantInsightsPage() {
  const {
    participantId,
    setParticipantId,
    from,
    setFrom,
    to,
    setTo,
    quickMonth,
    setQuickMonth,
    monthly,
    counterparts,
    visible,
    detailLoading,
    detailError,
    leaderboardLimit,
    setLeaderboardLimit,
    leaderboardGrouping,
    setLeaderboardGrouping,
    leaderboardLoading,
    leaderboardError,
    displayedLeaderboard,
    quickMonthOptions,
    handleSubmit,
    handleSelectParticipant,
  } = useParticipantInsightsData();

  const leaderboardColumns = getLeaderboardColumns();
  const monthlyColumns = getMonthlyColumns();
  const counterpartsColumns = getCounterpartsColumns();

  return (
    <section className={PAGE_CONTAINER}>
      <Card>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="grid items-end gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <Input
              label="ID participante"
              type="text"
              value={participantId}
              onChange={(e) => setParticipantId(e.target.value)}
              placeholder="123861706983"
              inputMode="numeric"
              enterKeyHint="search"
            />
            <Input label="Rango rápido" as="select" value={quickMonth} onChange={(e) => setQuickMonth(e.target.value)}>
              {quickMonthOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Input>
            <Input
              label="Desde"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              disabled={quickMonth !== "custom"}
            />
            <Input
              label="Hasta"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              disabled={quickMonth !== "custom"}
            />
            <div className="flex justify-end lg:col-span-4">
              <Button type="submit" disabled={detailLoading} isLoading={detailLoading}>
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
            <p className="text-base-content/70 text-sm">Contrapartes con mayores egresos en el rango seleccionado.</p>
          </div>
          <div className="flex flex-wrap gap-4">
            <div className="w-32">
              <Input
                label="Mostrar top"
                as="select"
                value={leaderboardLimit}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  setLeaderboardLimit(Number.isFinite(value) ? value : 10);
                }}
                className="select-sm"
              >
                {[10, 20, 30].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </Input>
            </div>
            <div className="w-40">
              <Input
                label="Agrupar por"
                as="select"
                value={leaderboardGrouping}
                onChange={(e) => setLeaderboardGrouping(e.target.value as "account" | "rut")}
                className="select-sm"
              >
                <option value="account">Cuenta bancaria</option>
                <option value="rut">RUT</option>
              </Input>
            </div>
          </div>
        </div>

        {leaderboardError && <Alert variant="error">{leaderboardError}</Alert>}

        <Card>
          <CardContent className="p-0">
            <DataTable
              columns={leaderboardColumns}
              data={displayedLeaderboard}
              isLoading={leaderboardLoading}
              meta={
                {
                  participantId,
                  onSelect: handleSelectParticipant,
                  detailLoading,
                } as LeaderboardMeta
              }
              noDataMessage={leaderboardLoading ? "Cargando ranking..." : "Sin participantes en el rango seleccionado."}
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
                  noDataMessage="Sin movimientos."
                  isLoading={detailLoading}
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
                  noDataMessage="No hay contrapartes."
                  isLoading={detailLoading}
                />
              </CardContent>
            </Card>
          </section>
        </div>
      ) : (
        <div className="text-base-content/50 py-12 text-center">
          {detailLoading
            ? "Buscando información del participante..."
            : "Ingresa un identificador y selecciona el rango para ver su actividad."}
        </div>
      )}
    </section>
  );
}
