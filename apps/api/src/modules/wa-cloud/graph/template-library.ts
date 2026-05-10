import { graphGet, graphPost, loadAccount } from "./_http.ts";

// Template Library (Meta 2026): pre-curated templates that can be cloned
// into a WABA without going through approval review. Useful for common
// utility patterns (appointment reminder, account update, payment update).
//
// Endpoints:
//   GET  /{waba}/message_template_library      → catalog Meta provides
//   POST /{waba}/message_templates             → clone with source=library

export type LibraryTemplate = {
  id: string;
  name: string;
  language: string;
  category: string;
  topic?: string;
  industry?: string[];
  use_case?: string;
  body?: string;
  header?: string;
  footer?: string;
  buttons?: Array<{ type: string; text: string; url?: string }>;
  parameter_format?: string;
};

export async function listTemplateLibrary(
  accountId: number,
  filters?: {
    category?: string;
    topic?: string;
    industry?: string;
    language?: string;
    search?: string;
  },
) {
  const account = await loadAccount(accountId);
  if (!account?.systemUserToken) throw new Error("Account sin token");
  const qs = new URLSearchParams();
  qs.set(
    "fields",
    "id,name,language,category,topic,industry,use_case,body,header,footer,buttons,parameter_format",
  );
  qs.set("limit", "200");
  if (filters?.category) qs.set("category", filters.category);
  if (filters?.topic) qs.set("topic", filters.topic);
  if (filters?.industry) qs.set("industry", filters.industry);
  if (filters?.language) qs.set("language", filters.language);
  if (filters?.search) qs.set("search", filters.search);
  const data = await graphGet<{ data: LibraryTemplate[] }>(
    `/${account.wabaId}/message_template_library?${qs.toString()}`,
    account.systemUserToken,
    account.graphApiVersion,
  );
  return data.data ?? [];
}

export type CloneFromLibraryInput = {
  accountId: number;
  libraryTemplateName: string;
  // The clone is named the same as the source by default; allow override.
  newName?: string;
  language: string;
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
};

export async function cloneTemplateFromLibrary(input: CloneFromLibraryInput) {
  const account = await loadAccount(input.accountId);
  if (!account?.systemUserToken) throw new Error("Account sin token");
  return graphPost<{ id: string; status: string; category: string }>(
    `/${account.wabaId}/message_templates`,
    {
      source: "library",
      library_template_name: input.libraryTemplateName,
      name: input.newName ?? input.libraryTemplateName,
      language: input.language,
      category: input.category,
    },
    account.systemUserToken,
    account.graphApiVersion,
  );
}
