import { Card, Chip } from "@heroui/react";
import { createFileRoute, Link } from "@tanstack/react-router";

import { BookingCta } from "@/components/BookingCta";
import { JsonLd } from "@/components/JsonLd";
import { PageShell } from "@/components/PageShell";
import { Container } from "@/components/ui/Container";
import { PageHero } from "@/components/ui/PageHero";
import { SectionBand } from "@/components/ui/SectionBand";
import { type EducationBlock, getTopic, relatedTopics } from "@/data/education";
import { breadcrumbJsonLd } from "@/lib/seo";
import { titleFromSlug } from "@/lib/slug";

function TopicBody({ blocks }: { blocks: EducationBlock[] }) {
  return (
    <div className="grid max-w-[720px] gap-5">
      {blocks.map((block, index) => {
        const key = `${block.type}-${index}`;
        switch (block.type) {
          case "h2":
            return (
              <h2
                className="mt-2 font-display text-[1.75rem] leading-[1.1] text-foreground sm:text-[2rem]"
                key={key}
              >
                {block.text}
              </h2>
            );
          case "ul":
            return (
              <ul className="grid gap-2" key={key}>
                {block.items.map((item) => (
                  <li className="flex items-start gap-3 text-base leading-relaxed" key={item}>
                    <span className="mt-2.5 rounded-full bg-brand-amber size-2 shrink-0" />
                    <span className="text-muted">{item}</span>
                  </li>
                ))}
              </ul>
            );
          case "p":
            return (
              <p className="text-muted text-base leading-relaxed sm:text-lg" key={key}>
                {block.text}
              </p>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}

function TopicNotFound() {
  return (
    <PageShell contained={false}>
      <PageHero
        crumbs={[
          { label: "Inicio", href: "/" },
          { label: "Aprende", href: "/aprende" },
          { label: "Tema no encontrado" },
        ]}
        eyebrow="Aprende"
        lede="No pudimos encontrar el tema que buscas. Puede que el enlace haya cambiado o que el contenido ya no esté disponible."
        title="Tema no encontrado"
      />
      <SectionBand borderTop tone="surface">
        <Link
          className="font-semibold text-brand-blue text-sm no-underline hover:underline underline-offset-4"
          to="/aprende"
        >
          ← Volver a Aprende
        </Link>
      </SectionBand>
    </PageShell>
  );
}

function TopicDetailPage() {
  const { slug } = Route.useParams();
  const topic = getTopic(slug);

  if (!topic) {
    return <TopicNotFound />;
  }

  const related = relatedTopics(topic.slug, 3);

  return (
    <PageShell contained={false}>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Inicio", path: "/" },
          { name: "Aprende", path: "/aprende" },
          { name: topic.title, path: `/aprende/${topic.slug}` },
        ])}
      />
      <PageHero
        actions={<span className="text-muted text-sm">{topic.readingMinutes} min de lectura</span>}
        crumbs={[
          { label: "Inicio", href: "/" },
          { label: "Aprende", href: "/aprende" },
          { label: topic.title },
        ]}
        eyebrow={topic.category}
        lede={topic.summary}
        title={topic.title}
      />

      <SectionBand borderTop tone="surface">
        <div className="mx-auto max-w-[760px]">
          <TopicBody blocks={topic.body} />
          <Link
            className="mt-8 inline-block font-semibold text-brand-blue text-sm no-underline hover:underline underline-offset-4"
            to="/aprende"
          >
            ← Volver a Aprende
          </Link>
        </div>
      </SectionBand>

      <SectionBand tone="surface2">
        <h2 className="font-display text-[1.75rem] text-foreground leading-[1.1] sm:text-[2rem]">
          Temas relacionados
        </h2>
        {related.length > 0 ? (
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((item) => (
              <Link
                className="no-underline"
                key={item.slug}
                params={{ slug: item.slug }}
                to="/aprende/$slug"
              >
                <Card
                  className="h-full rounded-2xl border border-line bg-surface transition hover:border-brand-amber hover:shadow-md"
                  variant="default"
                >
                  <Card.Header className="gap-3">
                    <Chip size="sm" variant="secondary">
                      {item.category}
                    </Chip>
                    <Card.Title className="font-display text-[1.2rem] text-foreground">
                      {item.title}
                    </Card.Title>
                  </Card.Header>
                </Card>
              </Link>
            ))}
          </div>
        ) : null}
        <p className="mt-6 text-muted text-sm leading-relaxed">
          ¿Buscas diagnóstico o tratamiento? Revisa{" "}
          <Link
            className="font-semibold text-brand-blue no-underline hover:underline underline-offset-4"
            to="/examenes"
          >
            Exámenes
          </Link>{" "}
          ·{" "}
          <Link
            className="font-semibold text-brand-blue no-underline hover:underline underline-offset-4"
            to="/inmunoterapia"
          >
            Inmunoterapia
          </Link>
        </p>
      </SectionBand>

      <Container className="pb-16">
        <BookingCta
          title="¿Tienes dudas sobre tu caso?"
          description="Agenda una evaluación con nuestro equipo y define el estudio o tratamiento adecuado para ti."
          location="aprende_topic"
        />
      </Container>
    </PageShell>
  );
}

export const Route = createFileRoute("/aprende/$slug")({
  component: TopicDetailPage,
  head: ({ params }) => {
    const origin = typeof window === "undefined" ? "https://bioalergia.cl" : window.location.origin;
    const url = `${origin}/aprende/${params.slug}`;
    const topic = getTopic(params.slug);
    const titleHuman = topic?.title ?? titleFromSlug(params.slug);
    const title = `${titleHuman} · Aprende Bioalergia`;
    const description = topic?.summary ?? `${titleHuman} en la sección educativa de Bioalergia.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { property: "og:url", content: url },
        { property: "og:image", content: `${origin}/og-image.png` },
        { name: "twitter:title", content: title },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:image", content: `${origin}/og-image.png` },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
});
