import { Button, Card } from "@heroui/react";
import { useNavigate } from "@tanstack/react-router";
import { CalendarDays, CalendarRange, Flame } from "lucide-react";

import type { CalendarSearchParams } from "@/features/calendar/types";

// Empty search object — the destination routes' `validateSearch`
// applies all defaults (from/to range, filters). Typed as
// `CalendarSearchParams` so the `<Link>` / `navigate({ search })`
// contract is satisfied without each field being enumerated here.
const emptyCalendarSearch: CalendarSearchParams = {} as CalendarSearchParams;

/**
 * `/calendar?tab=vista` panel — default tab.
 *
 * Landing surface for the calendar section. The actual calendar
 * grids live under `/clinical/*` (agenda / day / heatmap) — this
 * panel surfaces them as navigation cards so the `/calendar` host
 * stays the entry point for calendar-related work while preserving
 * the existing per-view URLs (and their search-param contracts).
 *
 * Imperative navigation via `useNavigate` avoids `<Link>`'s
 * compile-time requirement for the (large, defaulted) clinical
 * search-param schema; the destination routes apply their own
 * defaults in `validateSearch`.
 */
export function CalendarVistaPanel() {
  const navigate = useNavigate();

  return (
    <section className="space-y-4">
      <p className="text-default-500 text-sm">
        Vistas del calendario clínico. Selecciona una para abrir su panel completo.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Card variant="secondary">
          <Card.Content className="flex flex-col gap-3 p-4">
            <div className="flex items-start gap-3">
              <CalendarRange aria-hidden="true" className="mt-0.5 text-primary" size={20} />
              <div className="space-y-1">
                <p className="font-semibold text-sm">Agenda</p>
                <p className="text-default-400 text-xs">
                  Vista por rango de fechas con filtros por calendario y serie clínica.
                </p>
              </div>
            </div>
            <Button
              onPress={() => {
                void navigate({ to: "/clinical/agenda", search: emptyCalendarSearch });
              }}
              size="sm"
              variant="outline"
            >
              Abrir agenda
            </Button>
          </Card.Content>
        </Card>
        <Card variant="secondary">
          <Card.Content className="flex flex-col gap-3 p-4">
            <div className="flex items-start gap-3">
              <CalendarDays aria-hidden="true" className="mt-0.5 text-primary" size={20} />
              <div className="space-y-1">
                <p className="font-semibold text-sm">Día</p>
                <p className="text-default-400 text-xs">
                  Detalle hora a hora del día seleccionado.
                </p>
              </div>
            </div>
            <Button
              onPress={() => {
                void navigate({ to: "/clinical/day", search: emptyCalendarSearch });
              }}
              size="sm"
              variant="outline"
            >
              Abrir vista diaria
            </Button>
          </Card.Content>
        </Card>
        <Card variant="secondary">
          <Card.Content className="flex flex-col gap-3 p-4">
            <div className="flex items-start gap-3">
              <Flame aria-hidden="true" className="mt-0.5 text-primary" size={20} />
              <div className="space-y-1">
                <p className="font-semibold text-sm">Mapa de calor</p>
                <p className="text-default-400 text-xs">Densidad de citas semanales/mensuales.</p>
              </div>
            </div>
            <Button
              onPress={() => {
                void navigate({ to: "/clinical/heatmap", search: emptyCalendarSearch });
              }}
              size="sm"
              variant="outline"
            >
              Abrir mapa de calor
            </Button>
          </Card.Content>
        </Card>
      </div>
    </section>
  );
}
