import { Card, Chip } from "@heroui/react";
import { createFileRoute, Link } from "@tanstack/react-router";

import { BookingCta } from "@/components/BookingCta";
import { JsonLd } from "@/components/JsonLd";
import { PageShell } from "@/components/PageShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { type EducationCategory, educationTopics } from "@/data/education";
import { groupTopicsByCategory } from "@/lib/education-grouping";
import { breadcrumbJsonLd } from "@/lib/seo";

const CATEGORY_ORDER: EducationCategory[] = [
  "Respiratoria",
  "Ocular",
  "Piel",
  "Alimentaria",
  "Medicamentos",
  "Insectos",
  "Ocupacional",
  "General",
  "Emergencia",
];

const groupedTopics = groupTopicsByCategory(educationTopics, CATEGORY_ORDER);

function AprendeIndexPage() {
  return (
    <PageShell>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Inicio", path: "/" },
          { name: "Aprende", path: "/aprende" },
        ])}
      />
      <PageHeader
        crumbs={[{ label: "Inicio", href: "/" }, { label: "Aprende" }]}
        eyebrow="Educación"
        lede="Guías breves y claras para entender las condiciones alérgicas más frecuentes: qué son, cómo se manifiestan y cuándo consultar. Esta información es educativa y general; el diagnóstico y el tratamiento se definen siempre en la consulta médica."
        title="Aprende sobre alergias"
      />

      {groupedTopics.map((group) => (
        <section className="grid gap-5" key={group.category}>
          <h2 className="font-display text-[1.75rem] text-foreground leading-[1.1] sm:text-[2rem]">
            {group.category}
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {group.topics.map((topic) => (
              <Link
                className="no-underline"
                key={topic.slug}
                params={{ slug: topic.slug }}
                to="/aprende/$slug"
              >
                <Card
                  className="h-full rounded-2xl border border-line bg-surface transition hover:border-brand-amber hover:shadow-md"
                  variant="default"
                >
                  <Card.Header className="gap-3">
                    <Chip size="sm" variant="secondary">
                      {topic.category}
                    </Chip>
                    <Card.Title className="font-display text-[1.35rem] text-foreground leading-[1.15]">
                      {topic.title}
                    </Card.Title>
                    <Card.Description className="text-muted leading-relaxed">
                      {topic.summary}
                    </Card.Description>
                  </Card.Header>
                  <Card.Content className="pb-6">
                    <span className="text-muted text-xs">
                      {topic.readingMinutes} min de lectura
                    </span>
                  </Card.Content>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      ))}

      <BookingCta
        title="¿Tienes dudas sobre tus síntomas?"
        description="Agenda una evaluación con nuestro equipo y define el estudio o tratamiento adecuado para tu caso."
        location="aprende_index"
      />
    </PageShell>
  );
}

export const Route = createFileRoute("/aprende/")({
  component: AprendeIndexPage,
  head: () => {
    const origin = typeof window === "undefined" ? "https://bioalergia.cl" : window.location.origin;
    const url = `${origin}/aprende`;
    const title = "Aprende sobre alergias · Bioalergia";
    const description =
      "Guías educativas sobre rinitis, asma, dermatitis atópica, alergia alimentaria, urticaria y anafilaxia. Información clara de alergología en Concepción.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
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
