import { Breadcrumbs, Card, Chip, Link, Separator } from "@heroui/react";
import { createFileRoute } from "@tanstack/react-router";

import { BookingCta } from "@/components/BookingCta";
import { PageShell } from "@/components/PageShell";
import { polenContent, type PollenLevel } from "@/data/pollen";

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

      <section className="grid gap-6">
        <div className="grid gap-2">
          <h2 className="font-semibold text-(--ink) text-2xl">Escala de niveles (referencial)</h2>
          <p className="max-w-3xl text-(--ink-muted) text-sm leading-relaxed">{polenContent.unit}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {polenContent.scale.map((lvl) => (
            <Card className="rounded-3xl" key={lvl.label} variant="default">
              <Card.Header className="gap-3">
                <div className="flex items-center justify-between gap-3">
                  <Card.Title className="text-lg">{lvl.label}</Card.Title>
                  <Chip color={lvl.tone} size="sm" variant="soft">
                    {lvl.range}
                  </Chip>
                </div>
                <Card.Description className="text-(--ink-muted) text-sm leading-relaxed">
                  {lvl.description}
                </Card.Description>
              </Card.Header>
            </Card>
          ))}
        </div>
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
              monitoreo aerobiológico. Para conocer las mediciones actualizadas de polen en distintas
              ciudades de Chile, consulta la Red Chilena de monitoreo de pólenes.
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
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
});
