import { Breadcrumbs, Card, Chip, Separator } from "@heroui/react";
import { createFileRoute, Link } from "@tanstack/react-router";

import { BookingCta } from "@/components/BookingCta";
import { PageShell } from "@/components/PageShell";
import { type EducationBlock, getTopic } from "@/data/education";

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

  return (
    <PageShell>
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
        { name: "twitter:title", content: title },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
});
