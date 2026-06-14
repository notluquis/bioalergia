import { queryOptions } from "@tanstack/react-query";

import { siteContentClient } from "@/lib/orpc-client";

// Sólo /noticias es DB-backed (CMS, editable en intranet). El resto de las
// páginas de contenido son estáticas (hardcoded en src/data/*.ts).
export const contentQueries = {
  articles: () =>
    queryOptions({
      queryKey: ["site-content", "articles"],
      queryFn: async () => (await siteContentClient.listArticles()).data,
    }),
  article: (slug: string) =>
    queryOptions({
      queryKey: ["site-content", "article", slug],
      queryFn: async () => (await siteContentClient.getArticleBySlug({ slug })).data,
    }),
};
