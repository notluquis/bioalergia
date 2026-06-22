import type { PollenLevel as ApiPollenLevel } from "@finanzas/orpc-contracts/pollen";
import { Breadcrumbs, Card, Chip, Link, Separator } from "@heroui/react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { BookingCta } from "@/components/BookingCta";
import { ContentLoading } from "@/components/ContentState";
import { JsonLd } from "@/components/JsonLd";
import { PageShell } from "@/components/PageShell";
import { polenContent, type PollenLevel } from "@/data/pollen";
import { pollenClient } from "@/lib/orpc-client";
import { breadcrumbJsonLd } from "@/lib/seo";

const API_LEVEL_COLOR: Record<ApiPollenLevel, "danger" | "warning" | "success" | "default"> = {
  alto: "danger",
  medio: "warning",
  bajo: "success",
  nulo: "default",
};

const API_LEVEL_LABEL: Record<ApiPollenLevel, string> = {
  alto: "Alto",
  medio: "Medio",
  bajo: "Bajo",
  nulo: "Sin actividad",
};

/**
 * Escala UPI 0–5 (Universal Pollen Index de Google). Categorías en español y un
 * color representativo del heatmap de Google. Los círculos del pronóstico EN VIVO
 * usan el `colorHex` real que devuelve la API; esta tabla es la leyenda estática.
 */
const UPI_SCALE: { value: number; label: string; color: string; description: string }[] = [
  {
    value: 0,
    label: "Ninguno",
    color: "#9ca3af",
    description: "Sin actividad polínica relevante.",
  },
  {
    value: 1,
    label: "Muy bajo",
    color: "#4caf50",
    description: "Solo las personas muy sensibles podrían notar síntomas leves.",
  },
  {
    value: 2,
    label: "Bajo",
    color: "#8bc34a",
    description: "Las personas con alergia alta pueden presentar síntomas.",
  },
  {
    value: 3,
    label: "Moderado",
    color: "#f6c244",
    description: "La mayoría de las personas alérgicas empieza a presentar síntomas.",
  },
  {
    value: 4,
    label: "Alto",
    color: "#f08c2e",
    description: "Síntomas frecuentes; conviene limitar la exposición al aire libre.",
  },
  {
    value: 5,
    label: "Muy alto",
    color: "#e5534b",
    description: "Síntomas intensos; extrema las precauciones y refuerza el tratamiento.",
  },
];

function formatUpdatedAt(value: Date | string): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleDateString("es-CL", { day: "numeric", month: "long" });
}

/**
 * Widget de pronóstico en vivo: gramíneas desde la Google Pollen API (único
 * tipo con datos en Chile) + calendario mensual estimado de árboles/malezas.
 * Si el cache está vacío (sin key o cron sin correr) muestra solo el calendario.
 */
function PollenLiveWidget() {
  const { data, isLoading } = useQuery({
    queryKey: ["pollen-forecast"],
    queryFn: () => pollenClient.getForecast(),
  });

  const liveToday = data?.provenance.grass === "live" ? data.grassForecast[0] : undefined;
  const calendarGrass = data?.calendar.find((t) => t.type === "GRASS");
  // El polen de gramíneas vive en el hero (en vivo o estimado), así que la tira
  // de "estimación estacional" solo muestra árboles y malezas — sin duplicar.
  const estimatedTrio = (data?.calendar ?? []).filter((t) => t.type !== "GRASS");
  const todayYmd = new Date().toLocaleDateString("en-CA");

  return (
    <section className="grid gap-6">
      <div className="grid gap-2">
        <h2 className="font-semibold text-(--ink) text-2xl">Pronóstico de polen — Concepción</h2>
        <p className="max-w-3xl text-(--ink-muted) text-sm leading-relaxed">
          Las gramíneas se muestran en vivo (Google Pollen API); los árboles y las malezas son una
          estimación estacional, porque no existe una estación de monitoreo en el Biobío.
        </p>
      </div>

      {isLoading ? (
        <ContentLoading />
      ) : (
        <div className="grid gap-6">
          {/* Hero: gramíneas hoy — en vivo (UPI 0–5) o estimación del mes */}
          <Card className="rounded-3xl" variant="default">
            <Card.Content className="flex flex-col gap-5 py-6 sm:flex-row sm:items-center">
              {liveToday ? (
                <span
                  aria-hidden="true"
                  className="flex size-20 shrink-0 items-center justify-center rounded-full font-semibold text-3xl text-white"
                  style={{ backgroundColor: liveToday.colorHex ?? "var(--accent)" }}
                >
                  {liveToday.upi ?? "–"}
                </span>
              ) : (
                <span
                  aria-hidden="true"
                  className="flex size-20 shrink-0 items-center justify-center rounded-full border-2 border-(--border) border-dashed font-semibold text-(--ink-muted) text-lg"
                >
                  Est.
                </span>
              )}
              <div className="grid gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-(--ink) text-lg">Gramíneas hoy</span>
                  {liveToday ? (
                    <>
                      <Chip size="sm" variant="primary">
                        {liveToday.category ?? `Índice ${liveToday.upi ?? "–"}`}
                      </Chip>
                      {liveToday.inSeason ? (
                        <Chip color="warning" size="sm" variant="soft">
                          En temporada
                        </Chip>
                      ) : null}
                    </>
                  ) : calendarGrass ? (
                    <>
                      <Chip color={API_LEVEL_COLOR[calendarGrass.level]} size="sm" variant="soft">
                        {API_LEVEL_LABEL[calendarGrass.level]}
                      </Chip>
                      <Chip size="sm" variant="secondary">
                        Estimación del mes
                      </Chip>
                    </>
                  ) : null}
                </div>
                <p className="max-w-2xl text-(--ink-muted) text-sm leading-relaxed">
                  {liveToday?.indexDescription ??
                    (liveToday
                      ? "Índice de polen de gramíneas (0–5) para hoy en Concepción."
                      : "El pronóstico en vivo de gramíneas no está disponible ahora. Mostramos el nivel estimado del mes según el calendario polínico de la zona.")}
                </p>
                {liveToday && data?.updatedAt ? (
                  <span className="text-(--ink-muted) text-xs">
                    Actualizado el {formatUpdatedAt(data.updatedAt)} · fuente Google Pollen API
                  </span>
                ) : null}
              </div>
            </Card.Content>

            {/* Próximos días: solo en vivo, con hoy destacado */}
            {liveToday && data && data.grassForecast.length > 1 ? (
              <Card.Content className="flex flex-wrap gap-3 border-(--border) border-t pt-5 pb-6">
                {data.grassForecast.map((day) => {
                  const isToday = day.date === todayYmd;
                  return (
                    <div
                      className={`flex min-w-20 flex-col items-center gap-2 rounded-2xl px-4 py-3 ${
                        isToday ? "bg-(--surface-2) ring-2 ring-(--accent)" : "bg-(--surface-2)"
                      }`}
                      key={day.date}
                    >
                      <span className="text-(--ink-muted) text-xs">
                        {isToday
                          ? "Hoy"
                          : new Date(`${day.date}T00:00:00`).toLocaleDateString("es-CL", {
                              weekday: "short",
                              day: "numeric",
                            })}
                      </span>
                      <span
                        aria-hidden="true"
                        className="flex size-9 items-center justify-center rounded-full font-semibold text-sm text-white"
                        style={{ backgroundColor: day.colorHex ?? "var(--accent)" }}
                      >
                        {day.upi ?? "–"}
                      </span>
                      <span className="text-(--ink-muted) text-xs">{day.category ?? "—"}</span>
                    </div>
                  );
                })}
              </Card.Content>
            ) : null}
          </Card>

          {/* Recomendaciones de salud del día (Google, es) — solo en vivo */}
          {liveToday && liveToday.healthRecommendations.length > 0 ? (
            <Card className="rounded-3xl" variant="secondary">
              <Card.Header className="gap-1">
                <Card.Title className="text-base">Recomendaciones para hoy</Card.Title>
              </Card.Header>
              <Card.Content className="grid gap-2 pb-6">
                {liveToday.healthRecommendations.map((rec) => (
                  <div className="flex items-start gap-3 text-sm leading-relaxed" key={rec}>
                    <span className="mt-2 size-2 rounded-full bg-(--accent)" />
                    <span className="text-(--ink-muted)">{rec}</span>
                  </div>
                ))}
              </Card.Content>
            </Card>
          ) : null}

          {/* Estimación estacional: árboles + malezas (gramíneas ya van en el hero) */}
          {estimatedTrio.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {estimatedTrio.map((taxon) => (
                <Card className="rounded-3xl" key={taxon.type} variant="default">
                  <Card.Header className="gap-3">
                    <div className="flex items-center justify-between gap-3">
                      <Card.Title className="text-lg">{taxon.label}</Card.Title>
                      <Chip color={API_LEVEL_COLOR[taxon.level]} size="sm" variant="soft">
                        {API_LEVEL_LABEL[taxon.level]}
                      </Chip>
                    </div>
                    <Card.Description className="text-(--ink-muted) text-xs uppercase tracking-wide">
                      Estimación estacional
                    </Card.Description>
                  </Card.Header>
                  <Card.Content className="pb-6 text-(--ink-muted) text-sm leading-relaxed">
                    {taxon.examples.join(", ")}.
                  </Card.Content>
                </Card>
              ))}
            </div>
          ) : null}

          <p className="text-(--ink-muted) text-xs leading-relaxed">
            Gramíneas: Google Pollen API (en vivo). Árboles y malezas: calendario polínico estimado
            para la zona (referencial). Esta información es educativa y no reemplaza una evaluación
            médica.
          </p>
        </div>
      )}
    </section>
  );
}

const LEVEL_LABEL: Record<PollenLevel, string> = {
  alto: "Nivel alto",
  medio: "Nivel medio",
  bajo: "Nivel bajo",
};

const LEVEL_COLOR: Record<PollenLevel, "danger" | "warning" | "success"> = {
  alto: "danger",
  medio: "warning",
  bajo: "success",
};

function PolenPage() {
  return (
    <PageShell>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Inicio", path: "/" },
          { name: "Polen", path: "/polen" },
        ])}
      />
      <section className="grid gap-4">
        <Breadcrumbs>
          <Breadcrumbs.Item href="/">Inicio</Breadcrumbs.Item>
          <Breadcrumbs.Item>Polen</Breadcrumbs.Item>
        </Breadcrumbs>
        <div className="grid gap-3">
          <div className="text-(--ink-muted) text-xs uppercase tracking-[0.2em]">
            Educación · Aerobiología
          </div>
          <h1 className="font-semibold text-(--ink) text-3xl sm:text-4xl">
            Niveles de polen en Chile
          </h1>
          <p className="max-w-3xl text-(--ink-muted) text-base leading-relaxed sm:text-lg">
            {polenContent.intro}
          </p>
        </div>
      </section>

      <PollenLiveWidget />

      <section className="grid gap-6">
        <div className="grid gap-2">
          <h2 className="font-semibold text-(--ink) text-2xl">Escala del índice (UPI 0–5)</h2>
          <p className="max-w-3xl text-(--ink-muted) text-sm leading-relaxed">
            El pronóstico en vivo de gramíneas usa el Índice Universal de Polen (UPI) de Google, de
            0 a 5. Cada número y color de arriba corresponde a este nivel.
          </p>
        </div>
        <Card className="rounded-3xl" variant="default">
          <Card.Content className="grid gap-3 py-6">
            {UPI_SCALE.map((lvl) => (
              <div
                className="flex items-start gap-4 border-(--border) border-b pb-3 last:border-0 last:pb-0"
                key={lvl.value}
              >
                <span
                  aria-hidden="true"
                  className="flex size-9 shrink-0 items-center justify-center rounded-full font-semibold text-sm text-white"
                  style={{ backgroundColor: lvl.color }}
                >
                  {lvl.value}
                </span>
                <div className="grid gap-0.5">
                  <span className="font-medium text-(--ink) text-sm">{lvl.label}</span>
                  <span className="text-(--ink-muted) text-sm leading-relaxed">
                    {lvl.description}
                  </span>
                </div>
              </div>
            ))}
            <p className="text-(--ink-muted) text-xs leading-relaxed">{polenContent.unit}</p>
          </Card.Content>
        </Card>
      </section>

      <section className="grid gap-6">
        <div className="grid gap-2">
          <h2 className="font-semibold text-(--ink) text-2xl">Calendario polínico (referencial)</h2>
          <p className="max-w-3xl text-(--ink-muted) text-sm leading-relaxed">
            Orientación general para la zona centro-sur de Chile, incluida la Región del Biobío. Los
            niveles son aproximados y educativos: la temporada real varía cada año y según la
            localidad, el clima y la flora del entorno.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {polenContent.calendar.map((entry) => (
            <Card className="rounded-3xl" key={entry.season} variant="default">
              <Card.Header className="gap-3">
                <div className="flex items-center justify-between gap-3">
                  <Card.Title className="text-lg">{entry.season}</Card.Title>
                  <Chip color={LEVEL_COLOR[entry.level]} size="sm" variant="soft">
                    {LEVEL_LABEL[entry.level]}
                  </Chip>
                </div>
                <Card.Description className="text-(--ink-muted) text-xs uppercase tracking-wide">
                  {entry.months}
                </Card.Description>
              </Card.Header>
              <Card.Content className="pb-6">
                <p className="text-(--ink-muted) text-sm leading-relaxed">{entry.dominant}</p>
              </Card.Content>
            </Card>
          ))}
        </div>
      </section>

      <section className="grid gap-6">
        <h2 className="font-semibold text-(--ink) text-2xl">Tipos de polen</h2>
        <div className="grid gap-6 md:grid-cols-3">
          {polenContent.types.map((type) => (
            <Card className="rounded-3xl" key={type.name} variant="default">
              <Card.Header className="gap-3">
                <div className="flex items-center justify-between gap-3">
                  <Card.Title className="text-lg">{type.name}</Card.Title>
                  <Chip size="sm" variant="secondary">
                    {type.season}
                  </Chip>
                </div>
                <Card.Description className="text-(--ink-muted) leading-relaxed">
                  {type.examples}
                </Card.Description>
              </Card.Header>
              <Card.Content className="pb-6">
                <p className="text-(--ink-muted) text-sm leading-relaxed">{type.note}</p>
              </Card.Content>
            </Card>
          ))}
        </div>
      </section>

      <section className="grid gap-6">
        <h2 className="font-semibold text-(--ink) text-2xl">Cómo reducir la exposición</h2>
        <Card className="rounded-3xl" variant="default">
          <Card.Content className="grid gap-3 py-6">
            {polenContent.tips.map((tip) => (
              <div className="flex items-start gap-3 text-sm leading-relaxed" key={tip}>
                <span className="mt-2 rounded-full bg-(--accent) size-2" />
                <span className="text-(--ink-muted)">{tip}</span>
              </div>
            ))}
          </Card.Content>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="grid gap-4">
          <h2 className="font-semibold text-(--ink) text-2xl">Cómo se miden</h2>
          <Card className="rounded-3xl" variant="default">
            <Card.Content className="grid gap-3 py-6">
              {polenContent.howMeasured.map((step) => (
                <div className="flex items-start gap-3 text-sm leading-relaxed" key={step}>
                  <span className="mt-2 rounded-full bg-(--accent) size-2" />
                  <span className="text-(--ink-muted)">{step}</span>
                </div>
              ))}
            </Card.Content>
          </Card>
        </div>
        <div className="grid gap-4">
          <h2 className="font-semibold text-(--ink) text-2xl">Estaciones de monitoreo en Chile</h2>
          <Card className="rounded-3xl" variant="default">
            <Card.Content className="grid gap-3 py-6">
              {polenContent.stations.map((st) => (
                <div
                  className="flex items-center justify-between gap-3 border-border border-b pb-2 last:border-0 last:pb-0"
                  key={st.city}
                >
                  <span className="font-medium text-(--ink) text-sm">{st.city}</span>
                  <span className="text-(--ink-muted) text-xs">{st.region}</span>
                </div>
              ))}
              <p className="text-(--ink-muted) text-xs leading-relaxed">
                {polenContent.stationsNote}
              </p>
            </Card.Content>
          </Card>
        </div>
      </section>

      <section className="grid gap-6">
        <Card className="rounded-3xl" variant="secondary">
          <Card.Header className="gap-3">
            <div className="flex items-center justify-between gap-3">
              <Card.Title className="text-xl">
                Consulta los niveles de polen en tiempo real
              </Card.Title>
              <Chip size="sm" variant="tertiary">
                Recurso externo
              </Chip>
            </div>
            <Card.Description className="text-(--ink-muted) leading-relaxed">
              En Bioalergia hacemos educación sobre el polen, pero no operamos una estación de
              monitoreo aerobiológico. Para conocer las mediciones actualizadas de polen en
              distintas ciudades de Chile, consulta la Red Chilena de monitoreo de pólenes.
            </Card.Description>
          </Card.Header>
          <Card.Content className="grid gap-4 pb-6">
            <Separator variant="secondary" />
            <Link
              className="font-semibold text-(--accent)"
              href={polenContent.externalUrl}
              rel="noopener noreferrer"
              target="_blank"
            >
              Ver niveles de polen en polenes.cl
              <Link.Icon />
            </Link>
            <p className="text-(--ink-muted) text-xs leading-relaxed">
              polenes.cl es un sitio externo de la Red Chilena de monitoreo de pólenes. Se abrirá en
              una pestaña nueva; Bioalergia no controla su contenido ni sus datos.
            </p>
          </Card.Content>
        </Card>
      </section>

      <BookingCta
        title="¿El polen empeora tus síntomas cada temporada?"
        description="Si la primavera o el verano te traen rinitis o asma alérgica, evaluamos a qué pólenes reaccionas y definimos un plan de tratamiento e inmunoterapia a tu medida."
        location="polen_page"
      />
    </PageShell>
  );
}

export const Route = createFileRoute("/polen")({
  component: PolenPage,
  head: () => {
    const origin = typeof window === "undefined" ? "https://bioalergia.cl" : window.location.origin;
    const url = `${origin}/polen`;
    return {
      meta: [
        { title: "Niveles de polen en Chile · Bioalergia" },
        {
          name: "description",
          content:
            "Calendario polínico referencial, tipos de polen (árboles, gramíneas y malezas) y consejos para reducir la exposición. Educación sobre alergia al polen en Concepción y la Región del Biobío.",
        },
        { property: "og:title", content: "Niveles de polen en Chile · Bioalergia" },
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
        { property: "og:image", content: `${origin}/og-image.png` },
        { name: "twitter:image", content: `${origin}/og-image.png` },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
});
