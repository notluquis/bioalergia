import { Breadcrumbs, Card, Chip, Separator } from "@heroui/react";
import { createFileRoute, Link } from "@tanstack/react-router";

import { BookingCta } from "@/components/BookingCta";
import { JsonLd } from "@/components/JsonLd";
import { PageShell } from "@/components/PageShell";
import { type EducationBlock, getTopic, relatedTopics } from "@/data/education";
import { breadcrumbJsonLd } from "@/lib/seo";

function humanizeSlug(slug: string): string {
  return slug
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}

function TopicBody({ blocks }: { blocks: EducationBlock[] }) {
  return (
    <div className="grid gap-5">
      {blocks.map((block, index) => {
        const key = `${block.type}-${index}`;
        switch (block.type) {
          case "h2":
            return (
              <h2 className="mt-2 font-semibold text-(--ink) text-xl sm:text-2xl" key={key}>
                {block.text}
              </h2>
            );
          case "ul":
            return (
              <ul className="grid gap-2" key={key}>
                {block.items.map((item) => (
                  <li className="flex items-start gap-3 text-base leading-relaxed" key={item}>
                    <span className="mt-2.5 rounded-full bg-(--accent) size-2 shrink-0" />
                    <span className="text-(--ink-muted)">{item}</span>
                  </li>
                ))}
              </ul>
            );
          case "p":
            return (
              <p className="text-(--ink-muted) text-base leading-relaxed sm:text-lg" key={key}>
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
    <PageShell>
      <section className="grid gap-4">
        <Breadcrumbs>
          <Breadcrumbs.Item href="/">Inicio</Breadcrumbs.Item>
          <Breadcrumbs.Item href="/aprende">Aprende</Breadcrumbs.Item>
        </Breadcrumbs>
        <Card className="rounded-3xl" variant="secondary">
          <Card.Header className="gap-3">
            <Card.Title className="text-xl">Tema no encontrado</Card.Title>
            <Card.Description className="text-(--ink-muted) leading-relaxed">
              No pudimos encontrar el tema que buscas. Puede que el enlace haya cambiado o que el
              contenido ya no esté disponible.
            </Card.Description>
          </Card.Header>
          <Card.Content className="pb-6">
            <Link
              className="font-semibold text-(--ink) text-sm no-underline hover:underline"
              to="/aprende"
            >
              ← Volver a Aprende
            </Link>
          </Card.Content>
        </Card>
      </section>
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
    <PageShell>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Inicio", path: "/" },
          { name: "Aprende", path: "/aprende" },
          { name: topic.title, path: `/aprende/${topic.slug}` },
        ])}
      />
      <article className="grid gap-6">
        <Breadcrumbs>
          <Breadcrumbs.Item href="/">Inicio</Breadcrumbs.Item>
          <Breadcrumbs.Item href="/aprende">Aprende</Breadcrumbs.Item>
          <Breadcrumbs.Item>{topic.title}</Breadcrumbs.Item>
        </Breadcrumbs>

        <header className="grid gap-4">
          <h1 className="max-w-3xl font-semibold text-(--ink) text-3xl sm:text-4xl">
            {topic.title}
          </h1>
          <div className="flex flex-wrap items-center gap-3 text-(--ink-muted) text-sm">
            <Chip size="sm" variant="secondary">
              {topic.category}
            </Chip>
            <Separator className="h-4" orientation="vertical" />
            <span>{topic.readingMinutes} min de lectura</span>
          </div>
        </header>

        <Separator />

        <TopicBody blocks={topic.body} />

        <Separator />

        <Link
          className="font-semibold text-(--ink) text-sm no-underline hover:underline"
          to="/aprende"
        >
          ← Volver a Aprende
        </Link>
      </article>

      <section className="grid gap-4">
        <h2 className="font-semibold text-(--ink) text-xl">Temas relacionados</h2>
        {related.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((item) => (
              <Link
                className="no-underline"
                key={item.slug}
                params={{ slug: item.slug }}
                to="/aprende/$slug"
              >
                <Card
                  className="h-full rounded-3xl transition-shadow hover:shadow-md"
                  variant="default"
                >
                  <Card.Header className="gap-3">
                    <Chip size="sm" variant="secondary">
                      {item.category}
                    </Chip>
                    <Card.Title className="text-base">{item.title}</Card.Title>
                  </Card.Header>
                </Card>
              </Link>
            ))}
          </div>
        ) : null}
        <p className="text-(--ink-muted) text-sm leading-relaxed">
          ¿Buscas diagnóstico o tratamiento? Revisa{" "}
          <Link
            className="font-semibold text-(--accent) no-underline hover:underline"
            to="/examenes"
          >
            Exámenes
          </Link>{" "}
          ·{" "}
          <Link
            className="font-semibold text-(--accent) no-underline hover:underline"
            to="/inmunoterapia"
          >
            Inmunoterapia
          </Link>
        </p>
      </section>

      <BookingCta
        title="¿Tienes dudas sobre tu caso?"
        description="Agenda una evaluación con nuestro equipo y define el estudio o tratamiento adecuado para ti."
        location="aprende_topic"
      />
    </PageShell>
  );
}

export const Route = createFileRoute("/aprende/$slug")({
  component: TopicDetailPage,
  head: ({ params }) => {
    const origin = typeof window === "undefined" ? "https://bioalergia.cl" : window.location.origin;
    const url = `${origin}/aprende/${params.slug}`;
    const topic = getTopic(params.slug);
    const titleHuman = topic?.title ?? humanizeSlug(params.slug);
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
