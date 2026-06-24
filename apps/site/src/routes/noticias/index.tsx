import { Breadcrumbs, Card, Chip } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

import { ContentError, ContentLoading } from "@/components/ContentState";
import { JsonLd } from "@/components/JsonLd";
import { PageShell } from "@/components/PageShell";
import { contentQueries } from "@/features/content/queries";
import { breadcrumbJsonLd } from "@/lib/seo";

const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "long",
  year: "numeric",
};

function NoticiasPage() {
  const { data, isLoading, error } = useQuery(contentQueries.articles());

  return (
    <PageShell>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Inicio", path: "/" },
          { name: "Noticias", path: "/noticias" },
        ])}
      />
      <section className="grid gap-4">
        <Breadcrumbs>
          <Breadcrumbs.Item href="/">Inicio</Breadcrumbs.Item>
          <Breadcrumbs.Item>Noticias</Breadcrumbs.Item>
        </Breadcrumbs>
        <div className="grid gap-3">
          <div className="text-(--ink-muted) text-xs uppercase tracking-[0.2em]">Educación</div>
          <h1 className="font-semibold text-(--ink) text-3xl sm:text-4xl">
            Noticias y educación en alergias
          </h1>
          <p className="max-w-3xl text-(--ink-muted) text-base leading-relaxed sm:text-lg">
            Artículos escritos por nuestro equipo para ayudarte a entender, prevenir y manejar las
            enfermedades alérgicas. Contenido educativo y basado en evidencia, que no reemplaza la
            evaluación médica personalizada.
          </p>
        </div>
      </section>

      {isLoading ? (
        <ContentLoading />
      ) : error || !data ? (
        <ContentError />
      ) : (
        <section className="grid gap-6 md:grid-cols-2">
          {data.map((article) => {
            const publishedAt = article.published_at ?? article.created_at;
            const isoDate = new Date(publishedAt).toISOString();
            return (
              <Card
                className="rounded-3xl transition-shadow hover:shadow-md"
                key={article.slug}
                variant="default"
              >
                <Link
                  className="grid h-full gap-0 no-underline"
                  params={{ slug: article.slug }}
                  to="/noticias/$slug"
                >
                  <Card.Header className="gap-3">
                    <div className="flex items-center justify-between gap-3">
                      <Chip size="sm" variant="secondary">
                        {article.category}
                      </Chip>
                      <time className="text-(--ink-muted) text-xs" dateTime={isoDate}>
                        {new Date(publishedAt).toLocaleDateString("es-CL", DATE_FORMAT)}
                      </time>
                    </div>
                    <Card.Title className="text-lg">{article.title}</Card.Title>
                    <Card.Description className="text-(--ink-muted) leading-relaxed">
                      {article.excerpt}
                    </Card.Description>
                  </Card.Header>
                  <Card.Content className="mt-auto pb-6">
                    <div className="flex items-center justify-between gap-3 border-border border-t pt-4 text-(--ink-muted) text-xs">
                      <span>{article.reading_minutes} min de lectura</span>
                      <span className="font-semibold text-(--ink)">Leer artículo →</span>
                    </div>
                  </Card.Content>
                </Link>
              </Card>
            );
          })}
        </section>
      )}
    </PageShell>
  );
}

export const Route = createFileRoute("/noticias/")({
  component: NoticiasPage,
  head: () => {
    const origin = typeof window === "undefined" ? "https://bioalergia.cl" : window.location.origin;
    const url = `${origin}/noticias`;
    return {
      meta: [
        { title: "Noticias y educación en alergias · Bioalergia" },
        {
          name: "description",
          content:
            "Artículos educativos sobre alergias, diagnóstico, inmunoterapia y prevención, escritos por el equipo de Bioalergia en Concepción.",
        },
        { property: "og:title", content: "Noticias y educación en alergias · Bioalergia" },
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
