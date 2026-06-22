import type { PollenLevel } from "@finanzas/orpc-contracts/pollen";
import { Card, Chip, Link } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";

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
 * Indicador compacto de polen para el hero del landing. Resume el nivel de
 * gramíneas de hoy (en vivo si hay cache; si no, el estimado del mes) y enlaza a
 * /polen. Comparte el mismo queryKey que `PollenSnippet` para deduplicar la red.
 * Si la API falla no rompe el hero — simplemente no se renderiza.
 */
export function PollenHeroCard() {
  const { data } = useQuery({
    queryKey: ["pollen-forecast"],
    queryFn: () => pollenClient.getForecast(),
  });

  if (!data) return null;

  const liveToday = data.provenance.grass === "live" ? data.grassForecast[0] : undefined;
  const calendarGrass = data.calendar.find((t) => t.type === "GRASS");

  return (
    <Card className="rounded-2xl" variant="secondary">
      <Card.Content className="flex items-center gap-4 py-4">
        {liveToday ? (
          <span
            aria-hidden="true"
            className="flex size-12 shrink-0 items-center justify-center rounded-full font-semibold text-lg text-white"
            style={{ backgroundColor: liveToday.colorHex ?? "var(--accent)" }}
          >
            {liveToday.upi ?? "–"}
          </span>
        ) : (
          <span
            aria-hidden="true"
            className="flex size-12 shrink-0 items-center justify-center rounded-full border-2 border-(--border) border-dashed font-medium text-(--ink-muted) text-xs"
          >
            Est.
          </span>
        )}
        <div className="grid gap-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-(--ink) text-sm">Polen hoy · Concepción</span>
            {liveToday ? (
              <Chip size="sm" variant="primary">
                Gramíneas: {liveToday.category ?? liveToday.upi ?? "–"}
              </Chip>
            ) : calendarGrass ? (
              <Chip color={LEVEL_COLOR[calendarGrass.level]} size="sm" variant="soft">
                Gramíneas: {LEVEL_LABEL[calendarGrass.level]}
              </Chip>
            ) : null}
          </div>
          <Link className="font-medium text-(--accent) text-xs" href="/polen">
            Ver pronóstico de polen
            <Link.Icon />
          </Link>
        </div>
      </Card.Content>
    </Card>
  );
}
