import { Card, Chip } from "@heroui/react";
import { createFileRoute } from "@tanstack/react-router";

import { BookingCta } from "@/components/BookingCta";
import { JsonLd } from "@/components/JsonLd";
import { PageShell } from "@/components/PageShell";
import { Container } from "@/components/ui/Container";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { PageHero } from "@/components/ui/PageHero";
import { SectionBand } from "@/components/ui/SectionBand";
import { examenesContent } from "@/data/exams";
import { breadcrumbJsonLd } from "@/lib/seo";

function ExamenesPage() {
  return (
    <PageShell contained={false}>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Inicio", path: "/" },
          { name: "Exámenes", path: "/examenes" },
        ])}
      />

      <PageHero
        crumbs={[{ label: "Inicio", href: "/" }, { label: "Exámenes" }]}
        eyebrow="Diagnóstico"
        lede={examenesContent.intro}
        photo="patchWide"
        title="Exámenes y estudios de alergia"
      />

      <SectionBand borderTop tone="surface2">
        <Eyebrow className="mb-3">Estudios</Eyebrow>
        <h2 className="mb-9 max-w-2xl font-display text-[2rem] leading-[1.05] text-foreground sm:text-[2.5rem]">
          Pruebas y estudios disponibles.
        </h2>
        <div className="grid gap-6 md:grid-cols-2">
          {examenesContent.items.map((exam) => (
            <Card
              className="h-full rounded-2xl border border-line bg-surface"
              key={exam.id}
              variant="default"
            >
              <Card.Header className="gap-3">
                <div className="flex items-center justify-between gap-3">
                  <Card.Title className="font-display text-[1.4rem] text-foreground">
                    {exam.name}
                  </Card.Title>
                  <Chip size="sm" variant="secondary">
                    {exam.category}
                  </Chip>
                </div>
                <Card.Description className="text-muted leading-relaxed">
                  {exam.summary}
                </Card.Description>
              </Card.Header>
              <Card.Content className="grid gap-4 pb-6">
                <div className="grid gap-2">
                  {exam.detects.map((item) => (
                    <div className="flex items-start gap-3 text-sm leading-relaxed" key={item}>
                      <span className="mt-2 size-2 rounded-full bg-brand-amber" />
                      <span className="text-muted">{item}</span>
                    </div>
                  ))}
                </div>
                {(exam.duration || exam.prep) && (
                  <div className="grid gap-1 border-line border-t pt-4 text-muted text-xs">
                    {exam.duration ? (
                      <p>
                        <span className="font-semibold text-foreground">Duración: </span>
                        {exam.duration}
                      </p>
                    ) : null}
                    {exam.prep ? (
                      <p>
                        <span className="font-semibold text-foreground">Preparación: </span>
                        {exam.prep}
                      </p>
                    ) : null}
                  </div>
                )}
              </Card.Content>
            </Card>
          ))}
        </div>
      </SectionBand>

      <Container className="pb-16">
        <BookingCta
          title="¿No sabes qué examen necesitas?"
          description="En la primera consulta evaluamos tu historia clínica y solicitamos solo los estudios que aportan información útil para tu diagnóstico."
          location="examenes_page"
        />
      </Container>
    </PageShell>
  );
}

export const Route = createFileRoute("/examenes")({
  component: ExamenesPage,
  head: () => {
    const origin = typeof window === "undefined" ? "https://bioalergia.cl" : window.location.origin;
    const url = `${origin}/examenes`;
    return {
      meta: [
        { title: "Exámenes de alergia · Bioalergia" },
        {
          name: "description",
          content:
            "Test ALEX2 molecular, prick test, test de parche, pruebas intradérmicas, provocación controlada y más. Diagnóstico de alergias en Concepción.",
        },
        { property: "og:title", content: "Exámenes de alergia · Bioalergia" },
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
