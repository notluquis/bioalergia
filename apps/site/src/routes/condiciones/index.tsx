import { Breadcrumbs, Card } from "@heroui/react";
import { createFileRoute, Link } from "@tanstack/react-router";

import { BookingCta } from "@/components/BookingCta";
import { JsonLd } from "@/components/JsonLd";
import { PageShell } from "@/components/PageShell";
import { conditions } from "@/data/conditions";
import { breadcrumbJsonLd } from "@/lib/seo";

function CondicionesIndexPage() {
  return (
    <PageShell>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Inicio", path: "/" },
          { name: "Condiciones", path: "/condiciones" },
        ])}
      />
      <section className="grid gap-4">
        <Breadcrumbs>
          <Breadcrumbs.Item href="/">Inicio</Breadcrumbs.Item>
          <Breadcrumbs.Item>Condiciones</Breadcrumbs.Item>
        </Breadcrumbs>
        <div className="grid gap-3">
          <div className="text-(--ink-muted) text-xs uppercase tracking-[0.2em]">Condiciones</div>
          <h1 className="font-semibold text-(--ink) text-3xl sm:text-4xl">
            Alergias e inmunología: guías por condición
          </h1>
          <p className="max-w-3xl text-(--ink-muted) text-base leading-relaxed sm:text-lg">
            Información clara y referencial sobre las condiciones alérgicas más frecuentes: qué son,
            cómo se diagnostican y cómo se tratan en Concepción. Cada guía incluye una
            autoevaluación rápida.
          </p>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        {conditions.map((condition) => (
          <Card className="rounded-3xl" key={condition.slug} variant="default">
            <Card.Header className="gap-2">
              <Card.Title className="text-xl">
                <Link
                  className="text-(--ink) no-underline hover:underline"
                  params={{ slug: condition.slug }}
                  to="/condiciones/$slug"
                >
                  {condition.title}
                </Link>
              </Card.Title>
              <Card.Description className="text-(--ink-muted) leading-relaxed">
                {condition.heroIntro}
              </Card.Description>
            </Card.Header>
            <Card.Content className="pb-6">
              <Link
                className="font-semibold text-(--ink) text-sm no-underline hover:underline"
                params={{ slug: condition.slug }}
                to="/condiciones/$slug"
              >
                Leer la guía →
              </Link>
            </Card.Content>
          </Card>
        ))}
      </section>

      <BookingCta
        title="¿Reconoces tus síntomas?"
        description="Agenda una evaluación y, con el estudio adecuado, identifiquemos qué desencadena tus molestias y el tratamiento que mejor se adapta a ti."
        location="condiciones_index"
      />
    </PageShell>
  );
}

export const Route = createFileRoute("/condiciones/")({
  component: CondicionesIndexPage,
  head: () => {
    const origin = typeof window === "undefined" ? "https://bioalergia.cl" : window.location.origin;
    const url = `${origin}/condiciones`;
    const title = "Condiciones de alergia e inmunología · Bioalergia";
    const description =
      "Guías por condición: rinitis, asma, conjuntivitis, urticaria, alergia alimentaria, alergia a medicamentos y anafilaxia. Diagnóstico y tratamiento en Concepción.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
        { property: "og:image", content: `${origin}/og-image.png` },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:image", content: `${origin}/og-image.png` },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
});
