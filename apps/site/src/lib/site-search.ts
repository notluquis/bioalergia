// Client-side site search, extracted from routes/buscar.tsx so the matching
// logic is unit-testable without a React renderer. Behavior is byte-identical
// to the original inline filters: accent/case-insensitive substring match over
// title + description/summary/excerpt across static pages, education topics and
// DB-backed news articles.

/** Strip diacritics + lowercase for accent-insensitive matching. */
export function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/** Minimal shape a static marketing page needs to be searchable. */
export type SearchablePage = { title: string; description: string };
/** Minimal shape an education topic needs to be searchable. */
export type SearchableTopic = { title: string; summary: string };
/** Minimal shape a news article needs to be searchable. */
export type SearchableArticle = { title: string; excerpt: string };

export type SearchSources<P, T, A> = {
  pages: readonly P[];
  topics: readonly T[];
  articles: readonly A[];
};

export type SearchResults<P, T, A> = {
  pages: P[];
  topics: T[];
  articles: A[];
};

/**
 * Filters each source by an accent/case-insensitive substring match of the
 * trimmed query against the source's two searchable fields. An empty (or
 * whitespace-only) query returns empty arrays for every source — mirroring the
 * route's `hasQuery` short-circuit.
 */
export function searchSite<
  P extends SearchablePage,
  T extends SearchableTopic,
  A extends SearchableArticle,
>(query: string, sources: SearchSources<P, T, A>): SearchResults<P, T, A> {
  const needle = normalize(query.trim());
  if (needle.length === 0) {
    return { pages: [], topics: [], articles: [] };
  }
  return {
    pages: sources.pages.filter(
      (page) =>
        normalize(page.title).includes(needle) || normalize(page.description).includes(needle)
    ),
    topics: sources.topics.filter(
      (topic) =>
        normalize(topic.title).includes(needle) || normalize(topic.summary).includes(needle)
    ),
    articles: sources.articles.filter(
      (article) =>
        normalize(article.title).includes(needle) || normalize(article.excerpt).includes(needle)
    ),
  };
}
