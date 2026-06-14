import type { BodyBlock } from "@finanzas/orpc-contracts/site-content";
import { Breadcrumbs, Card, Chip, Separator } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

import { BookingCta } from "@/components/BookingCta";
import { ContentLoading } from "@/components/ContentState";
import { JsonLd } from "@/components/JsonLd";
import { PageShell } from "@/components/PageShell";
import { contentQueries } from "@/features/content/queries";
import { articleJsonLd, breadcrumbJsonLd } from "@/lib/seo";

const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "long",
  year: "numeric",
};

function ArticleBody({ blocks }: { blocks: BodyBlock[] }) {
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

function ArticleNotFound() {
  return (
    <PageShell>
      <section className="grid gap-4">
        <Breadcrumbs>
          <Breadcrumbs.Item href="/">Inicio</Breadcrumbs.Item>
          <Breadcrumbs.Item href="/noticias">Noticias</Breadcrumbs.Item>
        </Breadcrumbs>
        <Card className="rounded-3xl" variant="secondary">
          <Card.Header className="gap-3">
            <Card.Title className="text-xl">Artículo no encontrado</Card.Title>
            <Card.Description className="text-(--ink-muted) leading-relaxed">
              No pudimos encontrar el artículo que buscas. Puede que el enlace haya cambiado o que
              el contenido ya no esté disponible.
            </Card.Description>
          </Card.Header>
          <Card.Content className="pb-6">
            <Link
              className="font-semibold text-(--ink) text-sm no-underline hover:underline"
              to="/noticias"
            >
              ← Volver a noticias
            </Link>
          </Card.Content>
        </Card>
      </section>
    </PageShell>
  );
}

function ArticleDetailPage() {
  const { slug } = Route.useParams();
  const { data: article, isLoading, error } = useQuery(contentQueries.article(slug));

  if (isLoading) {
    return (
      <PageShell>
        <section className="grid gap-6">
          <Breadcrumbs>
            <Breadcrumbs.Item href="/">Inicio</Breadcrumbs.Item>
            <Breadcrumbs.Item href="/noticias">Noticias</Breadcrumbs.Item>
          </Breadcrumbs>
          <ContentLoading />
        </section>
      </PageShell>
    );
  }

  if (error || !article) {
    return <ArticleNotFound />;
  }

  const publishedAt = article.published_at ?? article.created_at;
  const isoDate = new Date(publishedAt).toISOString();
  const formattedDate = new Date(publishedAt).toLocaleDateString("es-CL", DATE_FORMAT);

  return (
    <PageShell>
      <JsonLd
        data={articleJsonLd({
          title: article.title,
          description: article.seo_description ?? article.excerpt,
          path: `/noticias/${article.slug}`,
          datePublished: isoDate,
        })}
      />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Inicio", path: "/" },
          { name: "Noticias", path: "/noticias" },
          { name: article.title, path: `/noticias/${article.slug}` },
        ])}
      />
      <article className="grid gap-6">
        <Breadcrumbs>
          <Breadcrumbs.Item href="/">Inicio</Breadcrumbs.Item>
          <Breadcrumbs.Item href="/noticias">Noticias</Breadcrumbs.Item>
          <Breadcrumbs.Item>{article.title}</Breadcrumbs.Item>
        </Breadcrumbs>

        <header className="grid gap-4">
          <h1 className="max-w-3xl font-semibold text-(--ink) text-3xl sm:text-4xl">
            {article.title}
          </h1>
          <div className="flex flex-wrap items-center gap-3 text-(--ink-muted) text-sm">
            <time dateTime={isoDate}>{formattedDate}</time>
            <Separator className="h-4" orientation="vertical" />
            <Chip size="sm" variant="secondary">
              {article.category}
            </Chip>
            <Separator className="h-4" orientation="vertical" />
            <span>{article.reading_minutes} min de lectura</span>
          </div>
        </header>

        <Separator />

        <ArticleBody blocks={article.body} />

        <Separator />

        <Link
          className="font-semibold text-(--ink) text-sm no-underline hover:underline"
          to="/noticias"
        >
          ← Volver a noticias
        </Link>
      </article>

      <BookingCta
        title="¿Tienes dudas sobre tu caso?"
        description="Agenda una evaluación con nuestro equipo y define el estudio o tratamiento adecuado para ti."
        location="noticias_article"
      />
    </PageShell>
  );
}

export const Route = createFileRoute("/noticias/$slug")({
  component: ArticleDetailPage,
  head: ({ params }) => {
    const origin = typeof window === "undefined" ? "https://bioalergia.cl" : window.location.origin;
    const url = `${origin}/noticias/${params.slug}`;
    const titleHuman = params.slug
      .split("-")
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(" ");
    const title = `${titleHuman} · Noticias Bioalergia`;
    const description = `${titleHuman} en las noticias de Bioalergia.`;
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
