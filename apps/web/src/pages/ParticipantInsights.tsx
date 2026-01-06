import dayjs from "dayjs";

import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import { Table, TableBody } from "@/components/ui/Table";
import { useParticipantInsightsData } from "@/features/participants/hooks/useParticipantInsightsData";
import { fmtCLP } from "@/lib/format";
import { formatRut } from "@/lib/rut";
import { PAGE_CONTAINER } from "@/lib/styles";
import { cn } from "@/lib/utils";

// Define interface for row types to avoid "any"
interface LeaderboardRow {
  key: string;
  selectKey?: string;
  displayName: string;
  rut: string;
  account: string;
  outgoingCount: number;
  outgoingAmount: number;
}

interface MonthlyRow {
  month: string;
  outgoingCount: number;
  outgoingAmount: number;
}

interface CounterpartRow {
  withdrawId?: string | null;
  counterpartId?: string | null;
  counterpart?: string;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankAccountType?: string | null;
  bankBranch?: string | null;
  bankAccountHolder?: string | null;
  identificationType?: string | null;
  identificationNumber?: string | number | null;
  outgoingCount: number;
  outgoingAmount: number;
}

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

        <LeaderboardTable
          loading={leaderboardLoading}
          data={displayedLeaderboard}
          participantId={participantId}
          onSelect={handleSelectParticipant}
          detailLoading={detailLoading}
        />
      </div>

      {detailError && <Alert variant="error">{detailError}</Alert>}

      {!visible ? (
        <div className="text-base-content/50 py-12 text-center">
          {detailLoading
            ? "Buscando información del participante..."
            : "Ingresa un identificador y selecciona el rango para ver su actividad."}
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Resumen mensual</h2>
            <Card>
              <CardContent className="p-0">
                <MonthlyTable data={monthly} />
              </CardContent>
            </Card>
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Contrapartes</h2>
            <Card>
              <CardContent className="p-0">
                <CounterpartsTable data={counterparts} />
              </CardContent>
            </Card>
          </section>
        </div>
      )}
    </section>
  );
}

// --- Subcomponents ---

const LEADERBOARD_COLUMNS = [
  { key: "displayName", label: "Titular" },
  { key: "rut", label: "RUT" },
  { key: "account", label: "Cuenta" },
  { key: "outgoingCount", label: "Egresos (#)" },
  { key: "outgoingAmount", label: "Egresos ($)" },
  { key: "action", label: "Acción" },
];

function LeaderboardTable({
  loading,
  data,
  participantId,
  onSelect,
  detailLoading,
}: {
  loading: boolean;
  data: LeaderboardRow[];
  participantId: string;
  onSelect: (key: string) => void;
  detailLoading: boolean;
}) {
  if (loading) {
    return (
      <Card>
        <CardContent className="text-base-content/70 p-6 text-center">Cargando ranking...</CardContent>
      </Card>
    );
  }

  if (!data?.length) {
    return (
      <Card>
        <CardContent className="text-base-content/70 p-6 text-center">
          Sin participantes en el rango seleccionado.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table columns={LEADERBOARD_COLUMNS}>
          <TableBody columnsCount={LEADERBOARD_COLUMNS.length}>
            {data.map((row) => {
              const participantKey = row.selectKey;
              const isActive = participantKey && participantId && participantKey === participantId.trim();

              return (
                <tr
                  key={row.key}
                  className={cn(
                    "border-base-200 hover:bg-base-200/50 border-b transition-colors last:border-0",
                    isActive && "bg-secondary/10"
                  )}
                >
                  <td className="px-4 py-3 font-medium">{row.displayName}</td>
                  <td className="px-4 py-3">{row.rut}</td>
                  <td className="px-4 py-3">{row.account}</td>
                  <td className="px-4 py-3">{row.outgoingCount}</td>
                  <td className="px-4 py-3">{fmtCLP(row.outgoingAmount)}</td>
                  <td className="px-4 py-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => participantKey && onSelect(participantKey)}
                      disabled={detailLoading || !participantKey}
                      className="h-8"
                    >
                      {detailLoading && isActive ? "Cargando..." : "Ver detalle"}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

const MONTHLY_COLUMNS = [
  { key: "month", label: "Mes" },
  { key: "outgoingCount", label: "Cant." },
  { key: "outgoingAmount", label: "Monto" },
];

function MonthlyTable({ data }: { data: MonthlyRow[] | undefined }) {
  if (!data?.length) {
    return <div className="text-base-content/70 p-6 text-center text-sm">Sin movimientos.</div>;
  }

  return (
    <Table columns={MONTHLY_COLUMNS}>
      <TableBody columnsCount={MONTHLY_COLUMNS.length}>
        {data.map((row) => (
          <tr key={row.month} className="border-base-200 hover:bg-base-200/30 border-b last:border-0">
            <td className="px-4 py-3 font-medium capitalize">{dayjs(row.month).format("MMMM YYYY")}</td>
            <td className="px-4 py-3">{row.outgoingCount}</td>
            <td className="px-4 py-3">{fmtCLP(row.outgoingAmount)}</td>
          </tr>
        ))}
      </TableBody>
    </Table>
  );
}

const COUNTERPARTS_COLUMNS = [
  { key: "holder", label: "Titular" },
  { key: "info", label: "Info" },
  { key: "amount", label: "Monto" },
];

function CounterpartsTable({ data }: { data: CounterpartRow[] | undefined }) {
  if (!data?.length) {
    return <div className="text-base-content/70 p-6 text-center text-sm">No hay contrapartes.</div>;
  }

  return (
    <Table columns={COUNTERPARTS_COLUMNS}>
      <TableBody columnsCount={COUNTERPARTS_COLUMNS.length}>
        {data.map((row) => {
          const key = row.withdrawId || row.counterpartId || row.counterpart;

          // Format bank info
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

          // Format metadata
          const metadataParts: string[] = [];
          if (row.withdrawId) metadataParts.push(row.withdrawId);
          if (row.identificationType && row.identificationNumber) {
            metadataParts.push(`${row.identificationType} ${row.identificationNumber}`);
          } else if (row.identificationNumber) {
            metadataParts.push(String(row.identificationNumber));
          }

          const metadata = metadataParts.join(" · ");

          // Safe Rut
          const formattedRut = row.identificationNumber ? formatRut(String(row.identificationNumber)) : "";

          return (
            <tr key={key} className="border-base-200 hover:bg-base-200/30 border-b last:border-0">
              <td className="px-4 py-3">
                <div className="text-sm font-medium">{row.bankAccountHolder || row.counterpart || "(desconocido)"}</div>
                <div className="text-base-content/60 mt-0.5 text-xs">{formattedRut || "-"}</div>
              </td>
              <td className="px-4 py-3">
                {bankSummary && <div className="text-xs">{bankSummary}</div>}
                {metadata && <div className="text-xs opacity-70">{metadata}</div>}
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <div className="text-sm font-medium">{fmtCLP(row.outgoingAmount)}</div>
                <div className="text-base-content/60 text-xs">{row.outgoingCount} txs</div>
              </td>
            </tr>
          );
        })}
      </TableBody>
    </Table>
  );
}
