import { Card, Chip } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

import { ContentError, ContentLoading } from "@/components/ContentState";
import { JsonLd } from "@/components/JsonLd";
import { PageShell } from "@/components/PageShell";
import { PageHero } from "@/components/ui/PageHero";
import { SectionBand } from "@/components/ui/SectionBand";
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
    <PageShell contained={false}>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Inicio", path: "/" },
          { name: "Noticias", path: "/noticias" },
        ])}
      />
      <PageHero
        crumbs={[{ label: "Inicio", href: "/" }, { label: "Noticias" }]}
        eyebrow="Educación"
        lede="Artículos escritos por nuestro equipo para ayudarte a entender, prevenir y manejar las enfermedades alérgicas. Contenido educativo y basado en evidencia, que no reemplaza la evaluación médica personalizada."
        title="Noticias y educación en alergias"
      />

      <SectionBand borderTop tone="surface2">
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
                  className="rounded-2xl border border-line bg-surface transition hover:border-brand-amber hover:shadow-md"
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
                        <time className="text-muted text-xs" dateTime={isoDate}>
                          {new Date(publishedAt).toLocaleDateString("es-CL", DATE_FORMAT)}
                        </time>
                      </div>
                      <Card.Title className="font-display text-[1.4rem] text-foreground leading-[1.15]">
                        {article.title}
                      </Card.Title>
                      <Card.Description className="text-muted leading-relaxed">
                        {article.excerpt}
                      </Card.Description>
                    </Card.Header>
                    <Card.Content className="mt-auto pb-6">
                      <div className="flex items-center justify-between gap-3 border-line border-t pt-4 text-muted text-xs">
                        <span>{article.reading_minutes} min de lectura</span>
                        <span className="font-semibold text-brand-blue">Leer artículo →</span>
                      </div>
                    </Card.Content>
                  </Link>
                </Card>
              );
            })}
          </section>
        )}
      </SectionBand>
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
