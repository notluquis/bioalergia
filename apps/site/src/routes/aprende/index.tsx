import { Breadcrumbs, Card, Chip } from "@heroui/react";
import { createFileRoute, Link } from "@tanstack/react-router";

import { BookingCta } from "@/components/BookingCta";
import { JsonLd } from "@/components/JsonLd";
import { PageShell } from "@/components/PageShell";
import { type EducationCategory, educationTopics } from "@/data/education";
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

const groupedTopics = CATEGORY_ORDER.map((category) => ({
  category,
  topics: educationTopics.filter((topic) => topic.category === category),
})).filter((group) => group.topics.length > 0);

function AprendeIndexPage() {
  return (
    <PageShell>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Inicio", path: "/" },
          { name: "Aprende", path: "/aprende" },
        ])}
      />
      <section className="grid gap-4">
        <Breadcrumbs>
          <Breadcrumbs.Item href="/">Inicio</Breadcrumbs.Item>
          <Breadcrumbs.Item>Aprende</Breadcrumbs.Item>
        </Breadcrumbs>
        <div className="grid gap-3">
          <div className="text-(--ink-muted) text-xs uppercase tracking-[0.2em]">Educación</div>
          <h1 className="font-semibold text-(--ink) text-3xl sm:text-4xl">
            Aprende sobre alergias
          </h1>
          <p className="max-w-3xl text-(--ink-muted) text-base leading-relaxed sm:text-lg">
            Guías breves y claras para entender las condiciones alérgicas más frecuentes: qué son,
            cómo se manifiestan y cuándo consultar. Esta información es educativa y general; el
            diagnóstico y el tratamiento se definen siempre en la consulta médica.
          </p>
        </div>
      </section>

      {groupedTopics.map((group) => (
        <section className="grid gap-4" key={group.category}>
          <h2 className="font-semibold text-(--ink) text-xl">{group.category}</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {group.topics.map((topic) => (
              <Link
                className="no-underline"
                key={topic.slug}
                params={{ slug: topic.slug }}
                to="/aprende/$slug"
              >
                <Card
                  className="h-full rounded-3xl transition-shadow hover:shadow-md"
                  variant="default"
                >
                  <Card.Header className="gap-3">
                    <Chip size="sm" variant="secondary">
                      {topic.category}
                    </Chip>
                    <Card.Title className="text-lg">{topic.title}</Card.Title>
                    <Card.Description className="text-(--ink-muted) leading-relaxed">
                      {topic.summary}
                    </Card.Description>
                  </Card.Header>
                  <Card.Content className="pb-6">
                    <span className="text-(--ink-muted) text-xs">
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
