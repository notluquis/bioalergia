import { Description, Skeleton } from "@heroui/react";
import dayjs from "dayjs";

import { fmtCLP } from "@/lib/format";

import type { BalancesApiResponse } from "../types";

export interface BalanceSummaryProps {
  error: null | string;
  loading: boolean;
  report: BalancesApiResponse | null | undefined;
}

type MismatchDay = NonNullable<BalancesApiResponse>["days"][number];

export function BalanceSummary({ error, loading, report }: Readonly<BalanceSummaryProps>) {
  const { hasRecordedBalances, lastExpected, lastRecorded, mismatchDays } =
    useBalanceReportSummary(report);

  if (loading) {
    return (
      <section className="card bg-background shadow-sm">
        <div className="card-body">
          <span className="card-title text-lg text-primary">Conciliación</span>
          {error && (
            <Description className="border-rose-300/80 border-l-4 bg-background px-4 py-2 text-rose-700 text-xs">
              {error}
            </Description>
          )}
          <div className="space-y-3">
            <div className="space-y-2 rounded-2xl border border-default-200 bg-default-50/60 p-4">
              <Skeleton className="h-4 w-1/2 rounded-md" />
              <Skeleton className="h-4 w-1/3 rounded-md" />
            </div>
            <div className="space-y-2 rounded-2xl border border-default-200 bg-default-50/60 p-4">
              <Skeleton className="h-4 w-1/4 rounded-md" />
              <Skeleton className="h-4 w-2/3 rounded-md" />
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (!report) {
    return (
      <section className="card bg-background shadow-sm">
        <div className="card-body">
          <span className="card-title text-lg text-primary">Conciliación</span>
          {error && (
            <Description className="border-rose-300/80 border-l-4 bg-background px-4 py-2 text-rose-700 text-xs">
              {error}
            </Description>
          )}
          <Description className="text-foreground text-sm">
            Selecciona un rango para revisar los saldos de cierre registrados.
          </Description>
        </div>
      </section>
    );
  }

  if (!hasRecordedBalances) {
    return (
      <section className="card bg-background shadow-sm">
        <div className="card-body">
          <span className="card-title text-lg text-primary">Conciliación</span>
          {error && (
            <Description className="border-rose-300/80 border-l-4 bg-background px-4 py-2 text-rose-700 text-xs">
              {error}
            </Description>
          )}
          <Description className="text-foreground text-sm">
            Aún no registras saldos de cierre para este rango. Actualiza la sección de Saldos
            diarios en la página de movimientos para comenzar la conciliación.
          </Description>
        </div>
      </section>
    );
  }

  return (
    <section className="card bg-background shadow-sm">
      <div className="card-body">
        <span className="card-title text-lg text-primary">Conciliación</span>
        {error && (
          <Description className="border-rose-300/80 border-l-4 bg-background px-4 py-2 text-rose-700 text-xs">
            {error}
          </Description>
        )}
        {/* Main content */}
        <div className="space-y-3 text-foreground text-xs">
          {report.previous && (
            <div className="rounded-2xl border border-default-200 bg-default-50 px-4 py-3 text-foreground">
              Saldo cierre previo ({dayjs(report.previous.date, "YYYY-MM-DD").format("DD-MM-YYYY")}{" "}
              23:59)
              <span className="ml-2 font-semibold text-foreground">
                {fmtCLP(report.previous.balance)}
              </span>
            </div>
          )}

          {lastRecorded && (
            <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/80 px-4 py-3 text-emerald-700">
              Último saldo registrado ({dayjs(lastRecorded.date, "YYYY-MM-DD").format("DD-MM-YYYY")}{" "}
              23:59)
              <span className="ml-2 font-semibold text-emerald-800">
                {fmtCLP(lastRecorded.recordedBalance)}
              </span>
              {lastRecorded.difference != null && Math.abs(lastRecorded.difference) > 1 && (
                <span className="ml-2 font-semibold text-rose-600">
                  Dif: {formatSignedCLP(lastRecorded.difference)}
                </span>
              )}
            </div>
          )}

          {!lastRecorded && lastExpected && (
            <div className="rounded-2xl border border-default-200 bg-default-50 px-4 py-3 text-foreground">
              Saldo esperado del último día (
              {dayjs(lastExpected.date, "YYYY-MM-DD").format("DD-MM-YYYY")}):
              <span className="ml-2 font-semibold text-foreground">
                {fmtCLP(lastExpected.expectedBalance)}
              </span>
            </div>
          )}

          {mismatchDays.length > 0 ? (
            <MismatchSummary mismatchDays={mismatchDays} />
          ) : (
            <Description className="font-semibold text-emerald-600">
              Los saldos registrados coinciden con los movimientos del rango seleccionado.
            </Description>
          )}
        </div>
      </div>
    </section>
  );
}

function formatSignedCLP(value: number) {
  return value >= 0 ? fmtCLP(value) : `-${fmtCLP(Math.abs(value))}`;
}

function MismatchSummary({ mismatchDays }: Readonly<{ mismatchDays: MismatchDay[] }>) {
  return (
    <div className="space-y-2 rounded-2xl border border-rose-200/70 bg-rose-50/60 px-4 py-3">
      <Description className="font-semibold text-rose-600">
        Hay {mismatchDays.length} día{mismatchDays.length > 1 ? "s" : ""} con diferencias entre el
        saldo esperado y el registrado.
      </Description>
      <ul className="space-y-1 text-foreground">
        {mismatchDays.slice(0, 5).map((day) => (
          <li
            className="flex flex-wrap items-center gap-2"
            key={dayjs(day.date, "YYYY-MM-DD").format("YYYY-MM-DD")}
          >
            <span className="font-medium text-foreground">
              {dayjs(day.date, "YYYY-MM-DD").format("DD-MM-YYYY")}
            </span>
            <span>Diferencia:</span>
            <span className="font-semibold text-rose-600">
              {formatSignedCLP(day.difference ?? 0)}
            </span>
            {day.expectedBalance != null && (
              <span className="text-default-500">Esperado {fmtCLP(day.expectedBalance)}</span>
            )}
            {day.recordedBalance != null && (
              <span className="text-default-500">Registrado {fmtCLP(day.recordedBalance)}</span>
            )}
          </li>
        ))}
        {mismatchDays.length > 5 && (
          <li className="text-default-500">... y {mismatchDays.length - 5} más</li>
        )}
      </ul>
    </div>
  );
}

function useBalanceReportSummary(report: BalancesApiResponse | null | undefined) {
  if (!report) {
    return {
      hasRecordedBalances: false,
      lastExpected: null,
      lastRecorded: null,
      mismatchDays: [],
    };
  }

  const mismatchDays = report.days.filter(
    (day) => day.difference != null && Math.abs(day.difference) > 1,
  );
  const hasRecordedBalances = report.days.some((day) => day.recordedBalance != null);
  const lastRecorded =
    [...report.days].toReversed().find((day) => day.recordedBalance != null) ?? null;
  const lastExpected =
    [...report.days].toReversed().find((day) => day.expectedBalance != null) ?? null;

  return { hasRecordedBalances, lastExpected, lastRecorded, mismatchDays };
}
