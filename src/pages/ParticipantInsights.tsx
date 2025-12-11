import dayjs from "dayjs";
import type { ChangeEvent } from "react";
import { fmtCLP } from "@/lib/format";
import { formatRut } from "@/lib/rut";
import { useParticipantInsightsData } from "@/features/participants/hooks/useParticipantInsightsData";
import Alert from "@/components/ui/Alert";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { PAGE_CONTAINER, TITLE_LG } from "@/lib/styles";

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

  return (
    <section className={PAGE_CONTAINER}>
      <div className="bg-base-100 space-y-2 p-6">
        <h1 className={TITLE_LG}>Participantes en transacciones</h1>
        <p className="text-base-content/70 max-w-2xl text-sm">
          Revisa la actividad de un identificador en los campos <strong>Desde</strong> y <strong>Hacia</strong>, con un
          resumen mensual y las contrapartes más frecuentes.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-base-100 text-base-content grid gap-4 p-6 text-sm lg:grid-cols-4">
        <Input
          label="ID participante"
          type="text"
          value={participantId}
          onChange={(event: ChangeEvent<HTMLInputElement>) => setParticipantId(event.target.value)}
          placeholder="123861706983"
          inputMode="numeric"
          enterKeyHint="search"
        />
        <Input
          label="Rango rápido"
          as="select"
          value={quickMonth}
          onChange={(event: ChangeEvent<HTMLSelectElement>) => setQuickMonth(event.target.value)}
        >
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
          onChange={(event: ChangeEvent<HTMLInputElement>) => setFrom(event.target.value)}
          disabled={quickMonth !== "custom"}
        />
        <Input
          label="Hasta"
          type="date"
          value={to}
          onChange={(event: ChangeEvent<HTMLInputElement>) => setTo(event.target.value)}
          disabled={quickMonth !== "custom"}
        />
        <div className="flex items-end">
          <Button type="submit" disabled={detailLoading} size="sm">
            {detailLoading ? "Buscando..." : "Consultar"}
          </Button>
        </div>
      </form>

      <section className="bg-base-100 space-y-4 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <h2 className="text-secondary text-lg font-semibold">Ranking de retiros</h2>
            <p className="text-base-content text-sm">
              Contrapartes con mayores egresos en el rango seleccionado, agrupadas por RUT y cuenta.
            </p>
          </div>
          <div className="text-base-content/70 flex flex-wrap gap-4 text-xs font-semibold tracking-wide uppercase">
            <Input
              label="Mostrar top"
              as="select"
              value={leaderboardLimit}
              onChange={(event: ChangeEvent<HTMLSelectElement>) => {
                const value = Number(event.target.value);
                setLeaderboardLimit(Number.isFinite(value) ? value : 10);
              }}
              className="normal-case"
            >
              {[10, 20, 30].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Input>
            <Input
              label="Agrupar por"
              as="select"
              value={leaderboardGrouping}
              onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                setLeaderboardGrouping(event.target.value as "account" | "rut")
              }
              className="normal-case"
            >
              <option value="account">Cuenta bancaria</option>
              <option value="rut">RUT</option>
            </Input>
          </div>
        </div>

        {leaderboardError && <Alert variant="error">{leaderboardError}</Alert>}

        <div className="overflow-x-auto">
          <table className="text-base-content min-w-full text-sm">
            <thead className="bg-base-200 text-secondary">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide uppercase">Titular</th>
                <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide uppercase">RUT</th>
                <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide uppercase">Cuenta</th>
                <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide uppercase">Egresos (count)</th>
                <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide uppercase">Egresos (monto)</th>
                <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide uppercase">Detalle</th>
              </tr>
            </thead>
            <tbody>
              {leaderboardLoading ? (
                <tr>
                  <td colSpan={6} className="text-base-content/70 px-4 py-6 text-center">
                    Cargando ranking...
                  </td>
                </tr>
              ) : displayedLeaderboard.length ? (
                displayedLeaderboard.map((row) => {
                  const participantKey = row.selectKey;
                  const isActive = participantKey && participantId && participantKey === participantId.trim();
                  return (
                    <tr
                      key={row.key}
                      className={`border-base-300 bg-base-200 even:bg-base-300 border-b transition-colors last:border-none ${
                        isActive ? "bg-secondary/15" : ""
                      }`}
                    >
                      <td className="text-base-content px-4 py-3 font-medium">{row.displayName}</td>
                      <td className="text-base-content px-4 py-3">{row.rut}</td>
                      <td className="text-base-content px-4 py-3">{row.account}</td>
                      <td className="text-base-content px-4 py-3">{row.outgoingCount}</td>
                      <td className="text-base-content px-4 py-3">{fmtCLP(row.outgoingAmount)}</td>
                      <td className="text-base-content px-4 py-3">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            if (!participantKey) return;
                            void handleSelectParticipant(participantKey);
                          }}
                          disabled={detailLoading || !participantKey}
                        >
                          {detailLoading && isActive ? "Cargando..." : "Ver detalle"}
                        </Button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="text-base-content/70 px-4 py-6 text-center">
                    Sin participantes en el rango seleccionado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {detailError && <Alert variant="error">{detailError}</Alert>}

      {!visible ? (
        <p className="text-base-content/70 text-sm">
          {detailLoading
            ? "Buscando información del participante..."
            : "Ingresa un identificador y selecciona el rango para ver su actividad."}
        </p>
      ) : (
        <div className="space-y-6">
          <section className="bg-base-100 space-y-3 p-6">
            <h2 className="text-primary text-lg font-semibold">Resumen mensual</h2>
            <div className="overflow-x-auto">
              <table className="text-base-content min-w-full text-sm">
                <thead className="bg-base-200 text-primary">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide uppercase">Mes</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide uppercase">
                      Egresos (count)
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide uppercase">
                      Egresos (monto)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {monthly?.map((row) => (
                    <tr
                      key={row.month}
                      className="border-base-300 bg-base-200 even:bg-base-300 border-b last:border-none"
                    >
                      <td className="text-base-content px-4 py-3 font-medium">
                        {dayjs(row.month).format("MMMM YYYY")}
                      </td>
                      <td className="text-base-content px-4 py-3">{row.outgoingCount}</td>
                      <td className="text-base-content px-4 py-3">{fmtCLP(row.outgoingAmount)}</td>
                    </tr>
                  ))}
                  {!monthly?.length && (
                    <tr>
                      <td colSpan={3} className="text-base-content/70 px-4 py-6 text-center">
                        Sin movimientos en el rango seleccionado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="bg-base-100 space-y-3 p-6">
            <h2 className="text-secondary text-lg font-semibold">Contrapartes</h2>
            <div className="overflow-x-auto">
              <table className="text-base-content min-w-full text-sm">
                <thead className="bg-base-200 text-secondary">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide uppercase">Titular</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide uppercase">RUT</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide uppercase">Cuenta</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide uppercase">
                      Egresos (count)
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide uppercase">
                      Egresos (monto)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {counterparts?.map((row) => {
                    const key = row.withdrawId || row.counterpartId || row.counterpart;
                    const bankParts: string[] = [];
                    if (row.bankName) bankParts.push(row.bankName);
                    if (row.bankAccountNumber) {
                      const accountLabel = row.bankAccountType
                        ? `${row.bankAccountType} · ${row.bankAccountNumber}`
                        : row.bankAccountNumber;
                      bankParts.push(accountLabel);
                    }
                    if (row.bankBranch) bankParts.push(row.bankBranch);
                    const bankSummary = bankParts.join(" · ");

                    const metadataParts: string[] = [];
                    if (row.withdrawId) metadataParts.push(row.withdrawId);
                    if (row.identificationType && row.identificationNumber) {
                      metadataParts.push(`${row.identificationType} ${row.identificationNumber}`);
                    } else if (row.identificationNumber) {
                      metadataParts.push(row.identificationNumber);
                    }
                    if (row.counterpartId && row.counterpartId !== row.counterpart) {
                      metadataParts.push(row.counterpartId);
                    }
                    const metadata = metadataParts.join(" · ");

                    // Formatear RUT de manera segura
                    const formattedRut =
                      row.identificationNumber && typeof row.identificationNumber === "string"
                        ? formatRut(row.identificationNumber)
                        : "";

                    return (
                      <tr key={key} className="border-base-300 bg-base-200 even:bg-base-300 border-b last:border-none">
                        <td className="text-base-content px-4 py-3">
                          <div className="font-medium">
                            {row.bankAccountHolder || row.counterpart || "(desconocido)"}
                          </div>
                          {bankSummary && <div className="text-base-content/90 text-xs">{bankSummary}</div>}
                          {metadata && <div className="text-base-content/80 text-xs">{metadata}</div>}
                        </td>
                        <td className="text-base-content px-4 py-3">{formattedRut || "-"}</td>
                        <td className="text-base-content px-4 py-3">
                          {row.bankAccountNumber || row.withdrawId || row.counterpartId || "-"}
                        </td>
                        <td className="text-base-content px-4 py-3">{row.outgoingCount}</td>
                        <td className="text-base-content px-4 py-3">{fmtCLP(row.outgoingAmount)}</td>
                      </tr>
                    );
                  })}
                  {!counterparts.length && (
                    <tr>
                      <td colSpan={5} className="text-base-content/70 px-4 py-6 text-center">
                        No hay contrapartes registradas.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
