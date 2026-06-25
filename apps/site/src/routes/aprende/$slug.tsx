import { Breadcrumbs, Card, Chip, Separator } from "@heroui/react";
import { createFileRoute, Link } from "@tanstack/react-router";

import { BookingCta } from "@/components/BookingCta";
import { JsonLd } from "@/components/JsonLd";
import { PageShell } from "@/components/PageShell";
import { Eyebrow } from "@/components/ui/Eyebrow";
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
                className="mt-2 font-display text-[1.6rem] text-foreground leading-[1.15] sm:text-[1.9rem]"
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
    <PageShell>
      <section className="grid gap-4">
        <Breadcrumbs>
          <Breadcrumbs.Item href="/">Inicio</Breadcrumbs.Item>
          <Breadcrumbs.Item href="/aprende">Aprende</Breadcrumbs.Item>
        </Breadcrumbs>
        <Card className="rounded-2xl border border-line bg-surface" variant="secondary">
          <Card.Header className="gap-3">
            <Card.Title className="font-display text-[1.5rem] text-foreground leading-[1.15]">
              Tema no encontrado
            </Card.Title>
            <Card.Description className="text-muted leading-relaxed">
              No pudimos encontrar el tema que buscas. Puede que el enlace haya cambiado o que el
              contenido ya no esté disponible.
            </Card.Description>
          </Card.Header>
          <Card.Content className="pb-6">
            <Link
              className="font-semibold text-brand-blue text-sm no-underline hover:underline underline-offset-4"
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

        <header className="grid max-w-[720px] gap-4">
          <Eyebrow>{topic.category}</Eyebrow>
          <h1 className="font-display text-[2.5rem] text-foreground leading-[1.04] sm:text-[3.25rem]">
            {topic.title}
          </h1>
          <div className="flex flex-wrap items-center gap-3 text-muted text-sm">
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
          className="font-semibold text-brand-blue text-sm no-underline hover:underline underline-offset-4"
          to="/aprende"
        >
          ← Volver a Aprende
        </Link>
      </article>

      <section className="grid gap-5">
        <h2 className="font-display text-[1.75rem] text-foreground leading-[1.1] sm:text-[2rem]">
          Temas relacionados
        </h2>
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
                  className="h-full rounded-2xl border border-line bg-surface transition hover:border-brand-amber hover:shadow-md"
                  variant="default"
                >
                  <Card.Header className="gap-3">
                    <Chip size="sm" variant="secondary">
                      {item.category}
                    </Chip>
                    <Card.Title className="font-display text-[1.2rem] text-foreground leading-[1.15]">
                      {item.title}
                    </Card.Title>
                  </Card.Header>
                </Card>
              </Link>
            ))}
          </div>
        ) : null}
        <p className="text-muted text-sm leading-relaxed">
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
