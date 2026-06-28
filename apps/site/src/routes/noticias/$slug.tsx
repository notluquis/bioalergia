import type { BodyBlock } from "@finanzas/orpc-contracts/site-content";
import { Chip, Separator } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

import { BookingCta } from "@/components/BookingCta";
import { ContentLoading } from "@/components/ContentState";
import { JsonLd } from "@/components/JsonLd";
import { PageShell } from "@/components/PageShell";
import { Container } from "@/components/ui/Container";
import { PageHero } from "@/components/ui/PageHero";
import { SectionBand } from "@/components/ui/SectionBand";
import { contentQueries } from "@/features/content/queries";
import { articleJsonLd, breadcrumbJsonLd } from "@/lib/seo";
import { titleFromSlug } from "@/lib/slug";

const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "long",
  year: "numeric",
};

function ArticleBody({ blocks }: { blocks: BodyBlock[] }) {
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

function ArticleNotFound() {
  return (
    <PageShell contained={false}>
      <PageHero
        crumbs={[
          { label: "Inicio", href: "/" },
          { label: "Noticias", href: "/noticias" },
          { label: "Artículo no encontrado" },
        ]}
        eyebrow="Noticias"
        lede="No pudimos encontrar el artículo que buscas. Puede que el enlace haya cambiado o que el contenido ya no esté disponible."
        title="Artículo no encontrado"
      />
      <SectionBand borderTop tone="surface">
        <Link
          className="font-semibold text-brand-blue text-sm no-underline hover:underline underline-offset-4"
          to="/noticias"
        >
          ← Volver a noticias
        </Link>
      </SectionBand>
    </PageShell>
  );
}

function ArticleDetailPage() {
  const { slug } = Route.useParams();
  const { data: article, isLoading, error } = useQuery(contentQueries.article(slug));

  if (isLoading) {
    return (
      <PageShell contained={false}>
        <PageHero
          crumbs={[
            { label: "Inicio", href: "/" },
            { label: "Noticias", href: "/noticias" },
          ]}
          eyebrow="Noticias"
          title="Cargando artículo…"
        />
        <SectionBand borderTop tone="surface">
          <ContentLoading />
        </SectionBand>
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
    <PageShell contained={false}>
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
      <PageHero
        actions={
          <div className="flex flex-wrap items-center gap-3 text-muted text-sm">
            <time dateTime={isoDate}>{formattedDate}</time>
            <Separator className="h-4" orientation="vertical" />
            <Chip size="sm" variant="secondary">
              {article.category}
            </Chip>
            <Separator className="h-4" orientation="vertical" />
            <span>{article.reading_minutes} min de lectura</span>
          </div>
        }
        crumbs={[
          { label: "Inicio", href: "/" },
          { label: "Noticias", href: "/noticias" },
          { label: article.title },
        ]}
        eyebrow="Noticias"
        title={article.title}
      />

      <SectionBand borderTop tone="surface">
        <div className="mx-auto max-w-[760px]">
          <ArticleBody blocks={article.body} />
          <Link
            className="mt-8 inline-block font-semibold text-brand-blue text-sm no-underline hover:underline underline-offset-4"
            to="/noticias"
          >
            ← Volver a noticias
          </Link>
        </div>
      </SectionBand>

      <Container className="pb-16">
        <BookingCta
          title="¿Tienes dudas sobre tu caso?"
          description="Agenda una evaluación con nuestro equipo y define el estudio o tratamiento adecuado para ti."
          location="noticias_article"
        />
      </Container>
    </PageShell>
  );
}

export const Route = createFileRoute("/noticias/$slug")({
  component: ArticleDetailPage,
  head: ({ params }) => {
    const origin = typeof window === "undefined" ? "https://bioalergia.cl" : window.location.origin;
    const url = `${origin}/noticias/${params.slug}`;
    const titleHuman = titleFromSlug(params.slug);
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
