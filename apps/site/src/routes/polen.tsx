import type { PollenLevel as ApiPollenLevel } from "@finanzas/orpc-contracts/pollen";
import { Card, Chip, Link, Separator } from "@heroui/react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Leaf } from "lucide-react";

import { BookingCta } from "@/components/BookingCta";
import { ContentLoading } from "@/components/ContentState";
import { JsonLd } from "@/components/JsonLd";
import { PageShell } from "@/components/PageShell";
import { Container } from "@/components/ui/Container";
import { PageHero } from "@/components/ui/PageHero";
import { SectionBand } from "@/components/ui/SectionBand";
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
 * Widget de pronóstico en vivo: gramíneas desde la Google Pollen API (único tipo
 * con datos reales en Chile). No mostramos árboles ni malezas porque no existe
 * un dato exacto para Concepción. Si el cache está vacío (sin key o cron sin
 * correr) cae al nivel estacional estimado de gramíneas.
 */
function PollenLiveWidget() {
  const { data, isLoading } = useQuery({
    queryKey: ["pollen-forecast"],
    queryFn: () => pollenClient.getForecast(),
  });

  const liveToday = data?.provenance.grass === "live" ? data.grassForecast[0] : undefined;
  // Google omite `indexInfo` fuera de temporada (gramíneas no polinizan en
  // invierno) → upi/colorHex null. No es UPI 0, es "sin actividad medible hoy":
  // se muestra neutro, sin el color de acento.
  const liveHasIndex = !!liveToday && liveToday.upi !== null;
  const calendarGrass = data?.calendar.find((t) => t.type === "GRASS");
  const todayYmd = new Date().toLocaleDateString("en-CA");

  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <h2 className="font-display text-[1.75rem] leading-[1.1] text-foreground sm:text-[2rem]">
          Pronóstico de gramíneas — Concepción
        </h2>
        <p className="max-w-3xl text-muted text-sm leading-relaxed">
          Mostramos el polen de gramíneas en vivo (Google Pollen API), el único tipo con datos
          reales para Chile. No publicamos niveles de árboles ni malezas: la API no los entrega en
          el país y no hay una estación de monitoreo en el Biobío que los mida.
        </p>
      </div>

      {isLoading ? (
        <ContentLoading />
      ) : (
        <div className="grid gap-6">
          {/* Hero: gramíneas hoy — en vivo (UPI 0–5) o estimación del mes */}
          <Card className="rounded-2xl border border-line bg-surface" variant="default">
            <Card.Content className="flex flex-col gap-5 py-6 sm:flex-row sm:items-center">
              {liveHasIndex ? (
                <span
                  aria-hidden="true"
                  className="flex size-20 shrink-0 items-center justify-center rounded-full font-semibold text-3xl text-white"
                  style={{ backgroundColor: liveToday.colorHex ?? "var(--accent)" }}
                >
                  {liveToday.upi}
                </span>
              ) : liveToday ? (
                <span
                  aria-hidden="true"
                  className="flex size-20 shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted"
                >
                  <Leaf className="size-8" />
                </span>
              ) : (
                <span
                  aria-hidden="true"
                  className="flex size-20 shrink-0 items-center justify-center rounded-full border-2 border-line border-dashed font-semibold text-lg text-muted"
                >
                  Est.
                </span>
              )}
              <div className="grid gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-display text-foreground text-xl">Gramíneas hoy</span>
                  {liveHasIndex ? (
                    <>
                      <Chip size="sm" variant="primary">
                        {liveToday.category ?? `Índice ${liveToday.upi}`}
                      </Chip>
                      {liveToday.inSeason ? (
                        <Chip color="warning" size="sm" variant="soft">
                          En temporada
                        </Chip>
                      ) : null}
                    </>
                  ) : liveToday ? (
                    <Chip color="default" size="sm" variant="soft">
                      Sin actividad
                    </Chip>
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
                <p className="max-w-2xl text-muted text-sm leading-relaxed">
                  {liveHasIndex
                    ? (liveToday.indexDescription ??
                      "Índice de polen de gramíneas (0–5) para hoy en Concepción.")
                    : liveToday
                      ? "Hoy no hay actividad polínica de gramíneas en Concepción. Las gramíneas polinizan de septiembre a marzo (peak noviembre–enero); fuera de ese período Google no reporta un índice."
                      : "El pronóstico en vivo de gramíneas no está disponible ahora. Mostramos el nivel estimado del mes según el calendario polínico de la zona."}
                </p>
                {liveToday && data?.updatedAt ? (
                  <span className="text-muted text-xs">
                    Actualizado el {formatUpdatedAt(data.updatedAt)} · fuente Google Pollen API
                  </span>
                ) : null}
              </div>
            </Card.Content>

            {/* Próximos días: solo en vivo, con hoy destacado */}
            {liveToday && data && data.grassForecast.length > 1 ? (
              <Card.Content className="flex flex-wrap gap-3 border-line border-t pt-5 pb-6">
                {data.grassForecast.map((day) => {
                  const isToday = day.date === todayYmd;
                  return (
                    <div
                      className={`flex min-w-20 flex-col items-center gap-2 rounded-xl bg-surface-2 px-4 py-3 ${
                        isToday ? "ring-2 ring-brand-amber" : ""
                      }`}
                      key={day.date}
                    >
                      <span className="text-muted text-xs">
                        {isToday
                          ? "Hoy"
                          : new Date(`${day.date}T00:00:00`).toLocaleDateString("es-CL", {
                              weekday: "short",
                              day: "numeric",
                            })}
                      </span>
                      {day.upi !== null ? (
                        <span
                          aria-hidden="true"
                          className="flex size-9 items-center justify-center rounded-full font-semibold text-sm text-white"
                          style={{ backgroundColor: day.colorHex ?? "var(--accent)" }}
                        >
                          {day.upi}
                        </span>
                      ) : (
                        <span
                          aria-hidden="true"
                          className="flex size-9 items-center justify-center rounded-full border border-line font-medium text-muted text-sm"
                        >
                          –
                        </span>
                      )}
                      <span className="text-muted text-xs">{day.category ?? "Sin act."}</span>
                    </div>
                  );
                })}
              </Card.Content>
            ) : null}
          </Card>

          {/* Recomendaciones de salud del día (Google, es) — solo en vivo */}
          {liveToday && liveToday.healthRecommendations.length > 0 ? (
            <Card className="rounded-2xl border border-line bg-surface" variant="secondary">
              <Card.Header className="gap-1">
                <Card.Title className="font-display text-[1.2rem] text-foreground">
                  Recomendaciones para hoy
                </Card.Title>
              </Card.Header>
              <Card.Content className="grid gap-2 pb-6">
                {liveToday.healthRecommendations.map((rec) => (
                  <div className="flex items-start gap-3 text-sm leading-relaxed" key={rec}>
                    <span className="mt-2 size-2 rounded-full bg-brand-amber" />
                    <span className="text-muted">{rec}</span>
                  </div>
                ))}
              </Card.Content>
            </Card>
          ) : null}

          {/* Qué representa el índice de gramíneas */}
          <Card className="rounded-2xl border border-line bg-surface" variant="secondary">
            <Card.Header className="gap-1">
              <Card.Title className="font-display text-[1.2rem] text-foreground">
                ¿Qué gramíneas mide este índice?
              </Card.Title>
            </Card.Header>
            <Card.Content className="grid gap-3 pb-6 text-muted text-sm leading-relaxed">
              <p>
                El índice agrupa el polen de toda la familia de los pastos (Poaceae) en un solo
                valor: bajo el microscopio sus granos no se distinguen entre especies, así que tanto
                Google como los estudios de aerobiología los cuentan juntos. En la zona centro-sur
                las gramíneas alergénicas más comunes son la{" "}
                <span className="text-foreground">ballica</span> (<em>Lolium</em>), el{" "}
                <span className="text-foreground">pasto ovillo</span> (<em>Dactylis</em>), el{" "}
                <span className="text-foreground">pasto miel</span> (<em>Holcus</em>) y la{" "}
                <span className="text-foreground">Poa</span>.
              </p>
              <p>
                Su temporada va de septiembre a marzo, con el peak entre noviembre y enero.
                Comparten alérgenos, por lo que quien reacciona a un pasto suele reaccionar a varios
                — clave al planificar la inmunoterapia.
              </p>
            </Card.Content>
          </Card>

          <p className="text-muted text-xs leading-relaxed">
            Fuente: Google Pollen API (gramíneas en vivo). Información educativa; no reemplaza una
            evaluación médica.
          </p>
        </div>
      )}
    </div>
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
    <PageShell contained={false}>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Inicio", path: "/" },
          { name: "Polen", path: "/polen" },
        ])}
      />

      <PageHero
        crumbs={[{ label: "Inicio", href: "/" }, { label: "Polen" }]}
        eyebrow="Educación · Aerobiología"
        lede={polenContent.intro}
        photo="prickArm"
        title="Niveles de polen en Chile"
      />

      <SectionBand borderTop tone="surface2">
        <PollenLiveWidget />
      </SectionBand>

      <SectionBand tone="surface">
        <div className="mb-6 grid gap-2">
          <h2 className="font-display text-[1.75rem] leading-[1.1] text-foreground sm:text-[2rem]">
            Escala del índice (UPI 0–5)
          </h2>
          <p className="max-w-3xl text-muted text-sm leading-relaxed">
            El pronóstico en vivo de gramíneas usa el Índice Universal de Polen (UPI) de Google, de
            0 a 5. Cada número y color de arriba corresponde a este nivel.
          </p>
        </div>
        <Card className="rounded-2xl border border-line bg-surface" variant="default">
          <Card.Content className="grid gap-3 py-6">
            {UPI_SCALE.map((lvl) => (
              <div
                className="flex items-start gap-4 border-line border-b pb-3 last:border-0 last:pb-0"
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
                  <span className="font-medium text-foreground text-sm">{lvl.label}</span>
                  <span className="text-muted text-sm leading-relaxed">{lvl.description}</span>
                </div>
              </div>
            ))}
            <p className="text-muted text-xs leading-relaxed">{polenContent.unit}</p>
          </Card.Content>
        </Card>
      </SectionBand>

      <SectionBand tone="bg">
        <div className="mb-6 grid gap-2">
          <h2 className="font-display text-[1.75rem] leading-[1.1] text-foreground sm:text-[2rem]">
            Calendario polínico (referencial)
          </h2>
          <p className="max-w-3xl text-muted text-sm leading-relaxed">
            Orientación general para la zona centro-sur de Chile, incluida la Región del Biobío. Los
            niveles son aproximados y educativos: la temporada real varía cada año y según la
            localidad, el clima y la flora del entorno.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {polenContent.calendar.map((entry) => (
            <Card
              className="rounded-2xl border border-line bg-surface"
              key={entry.season}
              variant="default"
            >
              <Card.Header className="gap-3">
                <div className="flex items-center justify-between gap-3">
                  <Card.Title className="font-display text-[1.2rem] text-foreground">
                    {entry.season}
                  </Card.Title>
                  <Chip color={LEVEL_COLOR[entry.level]} size="sm" variant="soft">
                    {LEVEL_LABEL[entry.level]}
                  </Chip>
                </div>
                <Card.Description className="text-muted text-xs uppercase tracking-wide">
                  {entry.months}
                </Card.Description>
              </Card.Header>
              <Card.Content className="pb-6">
                <p className="text-muted text-sm leading-relaxed">{entry.dominant}</p>
              </Card.Content>
            </Card>
          ))}
        </div>
      </SectionBand>

      <SectionBand tone="surface2">
        <h2 className="mb-6 font-display text-[1.75rem] leading-[1.1] text-foreground sm:text-[2rem]">
          Tipos de polen
        </h2>
        <div className="grid gap-6 md:grid-cols-3">
          {polenContent.types.map((type) => (
            <Card
              className="rounded-2xl border border-line bg-surface"
              key={type.name}
              variant="default"
            >
              <Card.Header className="gap-3">
                <div className="flex items-center justify-between gap-3">
                  <Card.Title className="font-display text-[1.2rem] text-foreground">
                    {type.name}
                  </Card.Title>
                  <Chip size="sm" variant="secondary">
                    {type.season}
                  </Chip>
                </div>
                <Card.Description className="text-muted leading-relaxed">
                  {type.examples}
                </Card.Description>
              </Card.Header>
              <Card.Content className="pb-6">
                <p className="text-muted text-sm leading-relaxed">{type.note}</p>
              </Card.Content>
            </Card>
          ))}
        </div>
      </SectionBand>

      <SectionBand tone="surface">
        <h2 className="mb-6 font-display text-[1.75rem] leading-[1.1] text-foreground sm:text-[2rem]">
          Cómo reducir la exposición
        </h2>
        <Card className="rounded-2xl border border-line bg-surface" variant="default">
          <Card.Content className="grid gap-3 py-6">
            {polenContent.tips.map((tip) => (
              <div className="flex items-start gap-3 text-sm leading-relaxed" key={tip}>
                <span className="mt-2 rounded-full bg-brand-amber size-2" />
                <span className="text-muted">{tip}</span>
              </div>
            ))}
          </Card.Content>
        </Card>
      </SectionBand>

      <SectionBand tone="bg" innerClassName="grid gap-6 lg:grid-cols-2">
        <div className="grid gap-4">
          <h2 className="font-display text-[1.75rem] leading-[1.1] text-foreground sm:text-[2rem]">
            Cómo se miden
          </h2>
          <Card className="rounded-2xl border border-line bg-surface" variant="default">
            <Card.Content className="grid gap-3 py-6">
              {polenContent.howMeasured.map((step) => (
                <div className="flex items-start gap-3 text-sm leading-relaxed" key={step}>
                  <span className="mt-2 rounded-full bg-brand-amber size-2" />
                  <span className="text-muted">{step}</span>
                </div>
              ))}
            </Card.Content>
          </Card>
        </div>
        <div className="grid gap-4">
          <h2 className="font-display text-[1.75rem] leading-[1.1] text-foreground sm:text-[2rem]">
            Estaciones de monitoreo en Chile
          </h2>
          <Card className="rounded-2xl border border-line bg-surface" variant="default">
            <Card.Content className="grid gap-3 py-6">
              {polenContent.stations.map((st) => (
                <div
                  className="flex items-center justify-between gap-3 border-line border-b pb-2 last:border-0 last:pb-0"
                  key={st.city}
                >
                  <span className="font-medium text-foreground text-sm">{st.city}</span>
                  <span className="text-muted text-xs">{st.region}</span>
                </div>
              ))}
              <p className="text-muted text-xs leading-relaxed">{polenContent.stationsNote}</p>
            </Card.Content>
          </Card>
        </div>
      </SectionBand>

      <SectionBand tone="surface2">
        <Card className="rounded-2xl border border-line bg-surface" variant="secondary">
          <Card.Header className="gap-3">
            <div className="flex items-center justify-between gap-3">
              <Card.Title className="font-display text-[1.4rem] text-foreground">
                Consulta los niveles de polen en tiempo real
              </Card.Title>
              <Chip size="sm" variant="tertiary">
                Recurso externo
              </Chip>
            </div>
            <Card.Description className="text-muted leading-relaxed">
              En Bioalergia hacemos educación sobre el polen, pero no operamos una estación de
              monitoreo aerobiológico. Para conocer las mediciones actualizadas de polen en
              distintas ciudades de Chile, consulta la Red Chilena de monitoreo de pólenes.
            </Card.Description>
          </Card.Header>
          <Card.Content className="grid gap-4 pb-6">
            <Separator variant="secondary" />
            <Link
              className="font-semibold text-brand-blue"
              href={polenContent.externalUrl}
              rel="noopener noreferrer"
              target="_blank"
            >
              Ver niveles de polen en polenes.cl
              <Link.Icon />
            </Link>
            <p className="text-muted text-xs leading-relaxed">
              polenes.cl es un sitio externo de la Red Chilena de monitoreo de pólenes. Se abrirá en
              una pestaña nueva; Bioalergia no controla su contenido ni sus datos.
            </p>
          </Card.Content>
        </Card>
      </SectionBand>

      <Container className="pb-16">
        <BookingCta
          title="¿El polen empeora tus síntomas cada temporada?"
          description="Si la primavera o el verano te traen rinitis o asma alérgica, evaluamos a qué pólenes reaccionas y definimos un plan de tratamiento e inmunoterapia a tu medida."
          location="polen_page"
        />
      </Container>
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
