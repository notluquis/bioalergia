import { Button, Card, Chip } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";

import { pollenClient } from "@/lib/orpc-client";

const LEVEL_LABEL: Record<string, string> = {
  alto: "Alto",
  medio: "Medio",
  bajo: "Bajo",
  nulo: "Sin actividad",
};

/**
 * Snippet de polen para el landing: resume el nivel del día (gramíneas en vivo
 * si hay cache; si no, el nivel estimado del mes) y enlaza a /polen. Si la API
 * falla no rompe la home — simplemente no se muestra el chip de nivel.
 */
export function PollenSnippet() {
  const { data } = useQuery({
    queryKey: ["pollen-forecast"],
    queryFn: () => pollenClient.getForecast(),
  });

  const liveGrass = data?.provenance.grass === "live" ? data.grassForecast[0] : undefined;
  const calendarGrass = data?.calendar.find((t) => t.type === "GRASS");

  // Google omite el índice fuera de temporada (upi null) → "sin actividad", no "–".
  const summary = liveGrass
    ? liveGrass.upi !== null
      ? { label: liveGrass.category ?? "Gramíneas", value: String(liveGrass.upi) }
      : { label: "Gramíneas", value: "sin actividad" }
    : calendarGrass
      ? { label: "Gramíneas", value: LEVEL_LABEL[calendarGrass.level] ?? "—" }
      : null;

  return (
    <Card className="rounded-3xl" variant="secondary">
      <Card.Content className="flex flex-wrap items-center justify-between gap-4 py-6">
        <div className="grid gap-1">
          <div className="flex items-center gap-3">
            <Card.Title className="text-lg">Polen hoy en Concepción</Card.Title>
            {summary ? (
              <Chip size="sm" variant="primary">
                {summary.label}: {summary.value}
              </Chip>
            ) : null}
          </div>
          <p className="max-w-xl text-(--ink-muted) text-sm leading-relaxed">
            Pronóstico de gramíneas en vivo y calendario polínico estimado para la Región del
            Biobío. Referencial; no reemplaza una evaluación médica.
          </p>
        </div>
        <Button className="rounded-full" variant="secondary" onPress={() => goToPolen()}>
          Ver pronóstico de polen
        </Button>
      </Card.Content>
    </Card>
  );
}

function goToPolen() {
  window.location.assign("/polen");
}
