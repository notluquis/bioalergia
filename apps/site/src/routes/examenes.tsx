import { Breadcrumbs, Card, Chip } from "@heroui/react";
import { createFileRoute } from "@tanstack/react-router";

import { BookingCta } from "@/components/BookingCta";
import { PageShell } from "@/components/PageShell";
import { examenesContent } from "@/data/exams";

function ExamenesPage() {
  return (
    <PageShell>
      <section className="grid gap-4">
        <Breadcrumbs>
          <Breadcrumbs.Item href="/">Inicio</Breadcrumbs.Item>
          <Breadcrumbs.Item>Exámenes</Breadcrumbs.Item>
        </Breadcrumbs>
        <div className="grid gap-3">
          <div className="text-(--ink-muted) text-xs uppercase tracking-[0.2em]">Diagnóstico</div>
          <h1 className="font-semibold text-(--ink) text-3xl sm:text-4xl">
            Exámenes y estudios de alergia
          </h1>
          <p className="max-w-3xl text-(--ink-muted) text-base leading-relaxed sm:text-lg">
            {examenesContent.intro}
          </p>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        {examenesContent.items.map((exam) => (
          <Card className="rounded-3xl" key={exam.id} variant="default">
            <Card.Header className="gap-3">
              <div className="flex items-center justify-between gap-3">
                <Card.Title className="text-lg">{exam.name}</Card.Title>
                <Chip size="sm" variant="secondary">
                  {exam.category}
                </Chip>
              </div>
              <Card.Description className="text-(--ink-muted) leading-relaxed">
                {exam.summary}
              </Card.Description>
            </Card.Header>
            <Card.Content className="grid gap-4 pb-6">
              <div className="grid gap-2">
                {exam.detects.map((item) => (
                  <div className="flex items-start gap-3 text-sm leading-relaxed" key={item}>
                    <span className="mt-2 rounded-full bg-(--accent) size-2" />
                    <span className="text-(--ink-muted)">{item}</span>
                  </div>
                ))}
              </div>
              {(exam.duration || exam.prep) && (
                <div className="grid gap-1 border-border border-t pt-4 text-(--ink-muted) text-xs">
                  {exam.duration ? (
                    <p>
                      <span className="font-semibold text-(--ink)">Duración: </span>
                      {exam.duration}
                    </p>
                  ) : null}
                  {exam.prep ? (
                    <p>
                      <span className="font-semibold text-(--ink)">Preparación: </span>
                      {exam.prep}
                    </p>
                  ) : null}
                </div>
              )}
            </Card.Content>
          </Card>
        ))}
      </section>

      <BookingCta
        title="¿No sabes qué examen necesitas?"
        description="En la primera consulta evaluamos tu historia clínica y solicitamos solo los estudios que aportan información útil para tu diagnóstico."
        location="examenes_page"
      />
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
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
});
