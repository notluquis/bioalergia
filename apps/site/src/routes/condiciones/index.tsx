import { Card } from "@heroui/react";
import { createFileRoute, Link } from "@tanstack/react-router";

import { BookingCta } from "@/components/BookingCta";
import { JsonLd } from "@/components/JsonLd";
import { PageShell } from "@/components/PageShell";
import { Container } from "@/components/ui/Container";
import { PageHero } from "@/components/ui/PageHero";
import { SectionBand } from "@/components/ui/SectionBand";
import { conditions } from "@/data/conditions";
import { breadcrumbJsonLd } from "@/lib/seo";

function CondicionesIndexPage() {
  return (
    <PageShell contained={false}>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Inicio", path: "/" },
          { name: "Condiciones", path: "/condiciones" },
        ])}
      />
      <PageHero
        crumbs={[{ label: "Inicio", href: "/" }, { label: "Condiciones" }]}
        eyebrow="Condiciones"
        lede="Información clara y referencial sobre las condiciones alérgicas más frecuentes: qué son, cómo se diagnostican y cómo se tratan en Concepción. Cada guía incluye una autoevaluación rápida."
        title="Alergias e inmunología: guías por condición"
      />

      <SectionBand borderTop tone="surface2">
        <div className="grid gap-6 md:grid-cols-2">
          {conditions.map((condition) => (
            <Card
              className="rounded-2xl border border-line bg-surface transition hover:border-brand-amber"
              key={condition.slug}
              variant="default"
            >
              <Card.Header className="gap-2">
                <Card.Title className="font-display text-[1.5rem] leading-[1.15]">
                  <Link
                    className="text-foreground no-underline hover:text-brand-blue"
                    params={{ slug: condition.slug }}
                    to="/condiciones/$slug"
                  >
                    {condition.title}
                  </Link>
                </Card.Title>
                <Card.Description className="text-muted leading-relaxed">
                  {condition.heroIntro}
                </Card.Description>
              </Card.Header>
              <Card.Content className="pb-6">
                <Link
                  className="font-semibold text-brand-blue text-sm no-underline hover:underline underline-offset-4"
                  params={{ slug: condition.slug }}
                  to="/condiciones/$slug"
                >
                  Leer la guía →
                </Link>
              </Card.Content>
            </Card>
          ))}
        </div>
      </SectionBand>

      <Container className="pb-16">
        <BookingCta
          title="¿Reconoces tus síntomas?"
          description="Agenda una evaluación y, con el estudio adecuado, identifiquemos qué desencadena tus molestias y el tratamiento que mejor se adapta a ti."
          location="condiciones_index"
        />
      </Container>
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
