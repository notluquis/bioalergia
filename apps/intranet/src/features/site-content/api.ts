import type {
  articleCreateInputSchema,
  articleUpdateInputSchema,
  contentStatusSchema,
} from "@finanzas/orpc-contracts/site-content";
import type { z } from "zod";

import { siteContentORPCClient, toSiteContentApiError } from "./orpc";

export type ContentStatus = z.infer<typeof contentStatusSchema>;
export type ArticleCreateInput = z.infer<typeof articleCreateInputSchema>;
export type ArticleUpdateInput = z.infer<typeof articleUpdateInputSchema>;

export const siteContentKeys = {
  all: ["site-content-admin"] as const,
  articles: () => [...siteContentKeys.all, "articles"] as const,
  article: (id: number) => [...siteContentKeys.all, "articles", id] as const,
};

export async function listArticles() {
  try {
    return (await siteContentORPCClient.adminListArticles()).data;
  } catch (error) {
    throw toSiteContentApiError(error);
  }
}

export async function getArticle(id: number) {
  try {
    return (await siteContentORPCClient.adminGetArticle({ id })).data;
  } catch (error) {
    throw toSiteContentApiError(error);
  }
}

export async function createArticle(input: ArticleCreateInput) {
  try {
    return (await siteContentORPCClient.adminCreateArticle(input)).data;
  } catch (error) {
    throw toSiteContentApiError(error);
  }
}

export async function updateArticle(input: ArticleUpdateInput) {
  try {
    return (await siteContentORPCClient.adminUpdateArticle(input)).data;
  } catch (error) {
    throw toSiteContentApiError(error);
  }
}

export async function deleteArticle(id: number) {
  try {
    return await siteContentORPCClient.adminDeleteArticle({ id });
  } catch (error) {
    throw toSiteContentApiError(error);
  }
}
