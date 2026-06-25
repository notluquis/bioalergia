import { Card, Chip, Label, Link, SearchField, Separator } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link as RouterLink } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";

import { ContentError, ContentLoading } from "@/components/ContentState";
import { PageShell } from "@/components/PageShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { educationTopics } from "@/data/education";
import { contentQueries } from "@/features/content/queries";
import { searchSite } from "@/lib/site-search";

// Client-side search over: static marketing pages + education topics
// (hardcoded) + DB-backed news articles (contentQueries.articles).
// Matching is accent/case-insensitive substring over title + description/summary.

const searchSchema = z.object({
  q: z.string().optional().default(""),
});

type StaticPage = {
  title: string;
  description: string;
  href: string;
};

// Hardcoded index of the main static marketing pages.
const staticPages: StaticPage[] = [
  {
    title: "Servicios",
    description: "Consultas y prestaciones de alergología e inmunología clínica.",
    href: "/servicios",
  },
  {
    title: "Exámenes",
    description: "Pruebas cutáneas, estudio de alérgenos y exámenes complementarios.",
    href: "/examenes",
  },
  {
    title: "Inmunoterapia",
    description: "Vacunas para la alergia que modifican la respuesta del sistema inmune.",
    href: "/inmunoterapia",
  },
  {
    title: "Botiquín",
    description: "Recomendaciones para tener tu botiquín listo frente a reacciones alérgicas.",
    href: "/botiquin",
  },
  {
    title: "Polen",
    description: "Información y seguimiento de pólenes relevantes en la región.",
    href: "/polen",
  },
  {
    title: "Equipo",
    description: "Conoce al equipo médico y profesional de Bioalergia.",
    href: "/equipo",
  },
  {
    title: "Compromiso social",
    description: "Nuestro compromiso con la comunidad y el acceso a la salud.",
    href: "/compromiso-social",
  },
  {
    title: "¿Eres alérgico?",
    description: "Orientación para saber si tus síntomas podrían tener un origen alérgico.",
    href: "/eres-alergico",
  },
  {
    title: "Tienda",
    description: "Productos seleccionados para el cuidado de la piel, hidratación y bienestar.",
    href: "/tienda",
  },
];

function useDebounced<T>(value: T, ms = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

function ResultCard({
  title,
  description,
  meta,
  children,
}: {
  title: string;
  description: string;
  meta?: string;
  children: (content: React.ReactNode) => React.ReactNode;
}) {
  const content = (
    <Card.Header className="gap-2">
      {meta ? (
        <Chip size="sm" variant="secondary">
          {meta}
        </Chip>
      ) : null}
      <Card.Title className="text-lg">{title}</Card.Title>
      <Card.Description className="text-muted leading-relaxed">{description}</Card.Description>
    </Card.Header>
  );
  return (
    <Card className="rounded-3xl transition-shadow hover:shadow-md" variant="default">
      {children(content)}
    </Card>
  );
}

function BuscarPage() {
  const navigate = Route.useNavigate();
  const { q } = Route.useSearch();

  // Local input state mirrors the URL `q`; debounced write back to the URL.
  const [input, setInput] = useState(q);
  useEffect(() => {
    setInput(q);
  }, [q]);
  const debouncedInput = useDebounced(input, 300);
  useEffect(() => {
    if (debouncedInput === q) return;
    void navigate({ search: { q: debouncedInput }, replace: true });
  }, [debouncedInput, q, navigate]);

  const { data: articles, isLoading, error } = useQuery(contentQueries.articles());

  const hasQuery = q.trim().length > 0;

  const {
    pages: pageMatches,
    topics: topicMatches,
    articles: articleMatches,
  } = useMemo(
    () =>
      searchSite(q, {
        pages: staticPages,
        topics: educationTopics,
        articles: articles ?? [],
      }),
    [q, articles]
  );

  const totalMatches = pageMatches.length + topicMatches.length + articleMatches.length;
  const hasOtherMatches = pageMatches.length > 0 || topicMatches.length > 0;
  // News section renders while loading/erroring, or when it has matches, or as the
  // sole carrier of the "no news" line when nothing else matched either.
  const showNewsSection =
    isLoading || Boolean(error) || articleMatches.length > 0 || hasOtherMatches;
  // Global empty state only when query yielded nothing across all groups and news settled.
  const showEmptyState = hasQuery && totalMatches === 0 && !isLoading && !error && !hasOtherMatches;

  return (
    <PageShell>
      <section className="grid gap-6">
        <PageHeader
          crumbs={[{ label: "Inicio", href: "/" }, { label: "Buscar" }]}
          title="Buscar"
          lede="Busca en nuestras páginas, contenidos educativos y noticias."
        />
        <SearchField
          aria-label="Buscar en el sitio"
          className="max-w-xl"
          onChange={setInput}
          value={input}
        >
          <Label className="sr-only">Buscar en el sitio</Label>
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder="Busca páginas, contenidos y noticias…" />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>
      </section>

      {!hasQuery ? (
        <p className="text-muted text-sm">
          Escribe arriba para buscar en páginas, contenidos educativos y noticias.
        </p>
      ) : (
        <div className="grid gap-12">
          {pageMatches.length > 0 ? (
            <section className="grid gap-4">
              <h2 className="font-display text-[1.75rem] text-foreground">Páginas</h2>
              <Separator />
              <div className="grid gap-6 md:grid-cols-2">
                {pageMatches.map((page) => (
                  <ResultCard description={page.description} key={page.href} title={page.title}>
                    {(content) => (
                      <Link className="grid h-full gap-0 no-underline" href={page.href}>
                        {content}
                      </Link>
                    )}
                  </ResultCard>
                ))}
              </div>
            </section>
          ) : null}

          {topicMatches.length > 0 ? (
            <section className="grid gap-4">
              <h2 className="font-display text-[1.75rem] text-foreground">Aprende</h2>
              <Separator />
              <div className="grid gap-6 md:grid-cols-2">
                {topicMatches.map((topic) => (
                  <ResultCard
                    description={topic.summary}
                    key={topic.slug}
                    meta={topic.category}
                    title={topic.title}
                  >
                    {(content) => (
                      <RouterLink
                        className="grid h-full gap-0 no-underline"
                        params={{ slug: topic.slug }}
                        to="/aprende/$slug"
                      >
                        {content}
                      </RouterLink>
                    )}
                  </ResultCard>
                ))}
              </div>
            </section>
          ) : null}

          {showNewsSection ? (
            <section className="grid gap-4">
              <h2 className="font-display text-[1.75rem] text-foreground">Noticias</h2>
              <Separator />
              {isLoading ? (
                <ContentLoading />
              ) : error ? (
                <ContentError />
              ) : articleMatches.length > 0 ? (
                <div className="grid gap-6 md:grid-cols-2">
                  {articleMatches.map((article) => (
                    <ResultCard
                      description={article.excerpt}
                      key={article.slug}
                      meta={article.category}
                      title={article.title}
                    >
                      {(content) => (
                        <RouterLink
                          className="grid h-full gap-0 no-underline"
                          params={{ slug: article.slug }}
                          to="/noticias/$slug"
                        >
                          {content}
                        </RouterLink>
                      )}
                    </ResultCard>
                  ))}
                </div>
              ) : (
                <p className="text-muted text-sm">No encontramos noticias para «{q.trim()}».</p>
              )}
            </section>
          ) : null}

          {showEmptyState ? (
            <Card className="rounded-3xl" variant="secondary">
              <Card.Header className="gap-2">
                <Card.Title className="text-lg">Sin resultados</Card.Title>
                <Card.Description className="text-muted leading-relaxed">
                  No encontramos resultados para «{q.trim()}». Prueba con otras palabras o revisa la
                  ortografía.
                </Card.Description>
              </Card.Header>
            </Card>
          ) : null}
        </div>
      )}
    </PageShell>
  );
}

export const Route = createFileRoute("/buscar")({
  component: BuscarPage,
  validateSearch: searchSchema,
  head: () => {
    const origin = typeof window === "undefined" ? "https://bioalergia.cl" : window.location.origin;
    const url = `${origin}/buscar`;
    return {
      meta: [
        { title: "Buscar · Bioalergia" },
        {
          name: "description",
          content:
            "Busca en las páginas, contenidos educativos y noticias de Bioalergia, clínica de alergología e inmunología en Concepción.",
        },
        { property: "og:title", content: "Buscar · Bioalergia" },
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
});
