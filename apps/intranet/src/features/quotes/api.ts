import type {
  CreateCompanyInput,
  CreateQuoteInput,
  CreateQuoteProductInput,
  UpdateCompanyInput,
  UpdateQuoteInput,
  UpdateQuoteProductInput,
} from "@finanzas/orpc-contracts/quotes";
import { quotesORPCClient, toQuotesApiError } from "./orpc";

// ── Query keys ────────────────────────────────────────────────────────
export const quotesKeys = {
  all: ["quotes"] as const,
  companies: () => [...quotesKeys.all, "companies"] as const,
  company: (id: number) => [...quotesKeys.companies(), id] as const,
  products: () => [...quotesKeys.all, "products"] as const,
  list: (companyId?: number) => [...quotesKeys.all, "list", companyId ?? "all"] as const,
  detail: (id: number) => [...quotesKeys.all, "detail", id] as const,
};

// ── Empresas ──────────────────────────────────────────────────────────
export async function listCompanies(q?: string) {
  try {
    const res = await quotesORPCClient.listCompanies(q ? { q } : {});
    return res.companies;
  } catch (error) {
    throw toQuotesApiError(error);
  }
}

export async function getCompany(id: number) {
  try {
    const res = await quotesORPCClient.getCompany({ id });
    return res.company;
  } catch (error) {
    throw toQuotesApiError(error);
  }
}

export async function createCompany(input: CreateCompanyInput) {
  try {
    const res = await quotesORPCClient.createCompany(input);
    return res.company;
  } catch (error) {
    throw toQuotesApiError(error);
  }
}

export async function updateCompany(input: UpdateCompanyInput) {
  try {
    const res = await quotesORPCClient.updateCompany(input);
    return res.company;
  } catch (error) {
    throw toQuotesApiError(error);
  }
}

export async function deleteCompany(id: number) {
  try {
    return await quotesORPCClient.deleteCompany({ id });
  } catch (error) {
    throw toQuotesApiError(error);
  }
}

// ── Catálogo de productos ─────────────────────────────────────────────
export async function listQuoteProducts() {
  try {
    const res = await quotesORPCClient.listQuoteProducts();
    return res.products;
  } catch (error) {
    throw toQuotesApiError(error);
  }
}

export async function createQuoteProduct(input: CreateQuoteProductInput) {
  try {
    const res = await quotesORPCClient.createQuoteProduct(input);
    return res.product;
  } catch (error) {
    throw toQuotesApiError(error);
  }
}

export async function updateQuoteProduct(input: UpdateQuoteProductInput) {
  try {
    const res = await quotesORPCClient.updateQuoteProduct(input);
    return res.product;
  } catch (error) {
    throw toQuotesApiError(error);
  }
}

export async function deleteQuoteProduct(id: number) {
  try {
    return await quotesORPCClient.deleteQuoteProduct({ id });
  } catch (error) {
    throw toQuotesApiError(error);
  }
}

// ── Cotizaciones ──────────────────────────────────────────────────────
export async function listQuotes(filter?: { companyId?: number; q?: string }) {
  try {
    const res = await quotesORPCClient.listQuotes(filter ?? {});
    return res.quotes;
  } catch (error) {
    throw toQuotesApiError(error);
  }
}

export async function getQuote(id: number) {
  try {
    const res = await quotesORPCClient.getQuote({ id });
    return res.quote;
  } catch (error) {
    throw toQuotesApiError(error);
  }
}

export async function createQuote(input: CreateQuoteInput) {
  try {
    const res = await quotesORPCClient.createQuote(input);
    return res.quote;
  } catch (error) {
    throw toQuotesApiError(error);
  }
}

export async function updateQuote(input: UpdateQuoteInput) {
  try {
    const res = await quotesORPCClient.updateQuote(input);
    return res.quote;
  } catch (error) {
    throw toQuotesApiError(error);
  }
}

export async function deleteQuote(id: number) {
  try {
    return await quotesORPCClient.deleteQuote({ id });
  } catch (error) {
    throw toQuotesApiError(error);
  }
}

// Genera el PDF (server-side) y dispara la descarga en el navegador.
export async function downloadQuotePdf(id: number, folio: number): Promise<void> {
  try {
    const file = await quotesORPCClient.generatePdf({ id });
    const blob = file instanceof Blob ? file : new Blob([file as BlobPart]);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download =
      file instanceof File && file.name
        ? file.name
        : `cotizacion_${String(folio).padStart(4, "0")}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    throw toQuotesApiError(error);
  }
}
