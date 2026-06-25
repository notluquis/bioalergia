import type { PollenLevel } from "@finanzas/orpc-contracts/pollen";
import { Card, Chip, Link } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Leaf } from "lucide-react";

import { pollenClient } from "@/lib/orpc-client";

const LEVEL_LABEL: Record<PollenLevel, string> = {
  alto: "Alto",
  medio: "Medio",
  bajo: "Bajo",
  nulo: "Sin actividad",
};

const LEVEL_COLOR: Record<PollenLevel, "danger" | "warning" | "success" | "default"> = {
  alto: "danger",
  medio: "warning",
  bajo: "success",
  nulo: "default",
};

/**
 * Indicador de polen para la columna izquierda del hero — resume el nivel de
 * gramíneas de hoy (en vivo si hay cache; si no, el estimado del mes) y enlaza a
 * /polen, llenando el espacio junto al widget de reserva. Comparte el queryKey
 * con `PollenSnippet` para deduplicar la red. Si la API falla no se renderiza.
 */
export function PollenHeroCard() {
  const { data } = useQuery({
    queryKey: ["pollen-forecast"],
    queryFn: () => pollenClient.getForecast(),
  });

  if (!data) return null;

  const liveToday = data.provenance.grass === "live" ? data.grassForecast[0] : undefined;
  // Google omite `indexInfo` cuando no hay polen medible → upi/colorHex null.
  // Eso NO es "0", es "sin actividad hoy": neutro, no color de acento.
  const liveHasIndex = !!liveToday && liveToday.upi !== null;
  const calendarGrass = data.calendar.find((t) => t.type === "GRASS");

  const why = liveHasIndex
    ? null
    : liveToday
      ? "Fuera de temporada: las gramíneas polinizan de septiembre a marzo."
      : "Estimación del mes (sin dato en vivo ahora).";

  return (
    <Card className="rounded-2xl border border-line bg-surface" variant="default">
      <Card.Content className="flex items-center gap-4 py-5">
        {liveHasIndex ? (
          <span
            aria-hidden="true"
            className="flex size-14 shrink-0 items-center justify-center rounded-full font-semibold text-lg text-white"
            style={{ backgroundColor: liveToday.colorHex ?? "var(--brand-amber)" }}
          >
            {liveToday.upi}
          </span>
        ) : liveToday ? (
          <span
            aria-hidden="true"
            className="flex size-14 shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted"
          >
            <Leaf className="size-5" />
          </span>
        ) : (
          <span
            aria-hidden="true"
            className="flex size-14 shrink-0 items-center justify-center rounded-full border-2 border-line border-dashed text-muted"
          >
            <CalendarDays className="size-5" />
          </span>
        )}
        <div className="grid gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-foreground text-sm">Polen hoy · Concepción</span>
            {liveHasIndex ? (
              <Chip size="sm" variant="primary">
                Gramíneas: {liveToday.category ?? liveToday.upi}
              </Chip>
            ) : liveToday ? (
              <Chip color="default" size="sm" variant="soft">
                Gramíneas: sin actividad
              </Chip>
            ) : calendarGrass ? (
              <Chip color={LEVEL_COLOR[calendarGrass.level]} size="sm" variant="soft">
                Gramíneas: {LEVEL_LABEL[calendarGrass.level]}
              </Chip>
            ) : null}
          </div>
          {why ? <span className="text-muted text-xs leading-snug">{why}</span> : null}
          <Link className="font-semibold text-brand-blue text-xs" href="/polen">
            Ver pronóstico de polen
            <Link.Icon />
          </Link>
        </div>
      </Card.Content>
    </Card>
  );
}
