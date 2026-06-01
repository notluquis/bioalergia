import { db } from "@finanzas/db";
import {
  companyListInputSchema,
  companyListResponseSchema,
  companyResponseSchema,
  createCompanyInputSchema,
  createQuoteInputSchema,
  createQuoteProductInputSchema,
  idInputSchema,
  okResponseSchema,
  quoteListInputSchema,
  quoteListResponseSchema,
  quoteProductListResponseSchema,
  quoteProductResponseSchema,
  quoteResponseSchema,
  updateCompanyInputSchema,
  updateQuoteInputSchema,
  updateQuoteProductInputSchema,
} from "@finanzas/orpc-contracts/quotes";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { z } from "zod";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { ORPCError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import type { Context as HonoContext } from "hono";
import { getSessionUser, hasPermission } from "../lib/auth.ts";
import { logError } from "../lib/logger.ts";
import { configureSuperjson } from "../lib/superjson-config.ts";
import {
  createCompany,
  deleteCompany,
  getCompanyOrThrow,
  listCompanies,
  serializeCompany,
  updateCompany,
} from "../services/companies.ts";
import {
  createQuoteProduct,
  deleteQuoteProduct,
  listQuoteProducts,
  serializeQuoteProduct,
  updateQuoteProduct,
} from "../services/quote-products.ts";
import {
  createQuote,
  deleteQuote,
  getQuoteOrThrow,
  listQuotes,
  serializeQuote,
  updateQuote,
} from "../services/quotes.ts";
import { SuperJSONRPCHandler } from "./superjson.ts";

configureSuperjson();

type QuotesORPCContext = { hono: HonoContext };
const base = os.$context<QuotesORPCContext>();

const authed = base.use(async ({ context, next }) => {
  const user = await getSessionUser(context.hono);
  if (!user) throw new ORPCError("UNAUTHORIZED", { message: "No autorizado" });
  return next({ context: { ...context, user } });
});

function requirePermission(action: string, subject: string) {
  return authed.use(async ({ context, next }) => {
    const ok = await hasPermission(context.user, action, subject);
    if (!ok) throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
    return next();
  });
}

const readCompanies = requirePermission("read", "Company");
const writeCompanies = requirePermission("update", "Company");
const readCatalog = requirePermission("read", "Quote");
const writeCatalog = requirePermission("update", "QuoteProduct");
const readQuotes = requirePermission("read", "Quote");
const createQuotes = requirePermission("create", "Quote");
const updateQuotes = requirePermission("update", "Quote");
const deleteQuotesPerm = requirePermission("delete", "Quote");

const quotesRouterBase = {
  // ── Empresas ───────────────────────────────────────────────────────
  listCompanies: readCompanies
    .route({ method: "GET", path: "/companies", tags: ["Quotes"] })
    .input(companyListInputSchema)
    .output(companyListResponseSchema)
    .handler(async ({ input }) => {
      const companies = await listCompanies(input?.q);
      return { companies: companies.map((c) => serializeCompany(c)) };
    }),

  getCompany: readCompanies
    .route({ method: "GET", path: "/companies/{id}", tags: ["Quotes"] })
    .input(idInputSchema)
    .output(companyResponseSchema)
    .handler(async ({ input }) => {
      const company = await getCompanyOrThrow(input.id);
      return { company: serializeCompany(company) };
    }),

  createCompany: writeCompanies
    .route({ method: "POST", path: "/companies", tags: ["Quotes"] })
    .input(createCompanyInputSchema)
    .output(companyResponseSchema)
    .handler(async ({ input }) => {
      const company = await createCompany(input);
      return { company: serializeCompany(company) };
    }),

  updateCompany: writeCompanies
    .route({ method: "POST", path: "/companies/{id}/update", tags: ["Quotes"] })
    .input(updateCompanyInputSchema)
    .output(companyResponseSchema)
    .handler(async ({ input }) => {
      const company = await updateCompany(input);
      return { company: serializeCompany(company) };
    }),

  deleteCompany: writeCompanies
    .route({ method: "DELETE", path: "/companies/{id}", tags: ["Quotes"] })
    .input(idInputSchema)
    .output(okResponseSchema)
    .handler(async ({ input }) => {
      await deleteCompany(input.id);
      return { ok: true as const };
    }),

  // ── Catálogo de productos ──────────────────────────────────────────
  listQuoteProducts: readCatalog
    .route({ method: "GET", path: "/products", tags: ["Quotes"] })
    .output(quoteProductListResponseSchema)
    .handler(async () => {
      const products = await listQuoteProducts();
      return { products: products.map((p) => serializeQuoteProduct(p)) };
    }),

  createQuoteProduct: writeCatalog
    .route({ method: "POST", path: "/products", tags: ["Quotes"] })
    .input(createQuoteProductInputSchema)
    .output(quoteProductResponseSchema)
    .handler(async ({ input }) => {
      const product = await createQuoteProduct(input);
      return { product: serializeQuoteProduct(product) };
    }),

  updateQuoteProduct: writeCatalog
    .route({ method: "POST", path: "/products/{id}/update", tags: ["Quotes"] })
    .input(updateQuoteProductInputSchema)
    .output(quoteProductResponseSchema)
    .handler(async ({ input }) => {
      const product = await updateQuoteProduct(input);
      return { product: serializeQuoteProduct(product) };
    }),

  deleteQuoteProduct: writeCatalog
    .route({ method: "DELETE", path: "/products/{id}", tags: ["Quotes"] })
    .input(idInputSchema)
    .output(okResponseSchema)
    .handler(async ({ input }) => {
      await deleteQuoteProduct(input.id);
      return { ok: true as const };
    }),

  // ── Cotizaciones ───────────────────────────────────────────────────
  listQuotes: readQuotes
    .route({ method: "GET", path: "/quotes", tags: ["Quotes"] })
    .input(quoteListInputSchema)
    .output(quoteListResponseSchema)
    .handler(async ({ input }) => {
      const quotes = await listQuotes(input);
      return { quotes };
    }),

  getQuote: readQuotes
    .route({ method: "GET", path: "/quotes/{id}", tags: ["Quotes"] })
    .input(idInputSchema)
    .output(quoteResponseSchema)
    .handler(async ({ input }) => {
      const quote = await getQuoteOrThrow(input.id);
      return { quote: serializeQuote(quote) };
    }),

  createQuote: createQuotes
    .route({ method: "POST", path: "/quotes", tags: ["Quotes"] })
    .input(createQuoteInputSchema)
    .output(quoteResponseSchema)
    .handler(async ({ input, context }) => {
      const quote = await createQuote(input, context.user.id);
      return { quote: serializeQuote(quote) };
    }),

  updateQuote: updateQuotes
    .route({ method: "POST", path: "/quotes/{id}/update", tags: ["Quotes"] })
    .input(updateQuoteInputSchema)
    .output(quoteResponseSchema)
    .handler(async ({ input }) => {
      const quote = await updateQuote(input);
      return { quote: serializeQuote(quote) };
    }),

  deleteQuote: deleteQuotesPerm
    .route({ method: "DELETE", path: "/quotes/{id}", tags: ["Quotes"] })
    .input(idInputSchema)
    .output(okResponseSchema)
    .handler(async ({ input }) => {
      await deleteQuote(input.id);
      return { ok: true as const };
    }),

  generatePdf: readQuotes
    .route({ method: "POST", path: "/quotes/{id}/pdf", tags: ["Quotes"] })
    .input(idInputSchema)
    .output(z.file())
    .handler(async ({ input }) => {
      const quote = await getQuoteOrThrow(input.id);
      const clinic = await db.clinicSettings.upsert({
        where: { id: 1 },
        update: {},
        create: { id: 1 },
      });

      // Lazy: pdf-lib pesa ~3MB en heap; cargar sólo al primer /pdf.
      const { generateQuotePdf } = await import("../modules/quotes/quote-pdf.service.ts");
      const pdfBytes = await generateQuotePdf({ clinic, quote: serializeQuote(quote) });

      const fileName = `cotizacion_${String(quote.folio).padStart(4, "0")}.pdf`;
      return new File([Buffer.from(pdfBytes)], fileName, { type: "application/pdf" });
    }),
};

export const quotesORPCRouter = base.prefix("/api/orpc/quotes").router(quotesRouterBase);

export const quotesORPCHandler = new SuperJSONRPCHandler(quotesORPCRouter, {
  interceptors: [
    onError((error) => {
      logError(error, { module: "api", operation: "orpc.quotes" });
    }),
  ],
});

export const quotesOpenAPIHandler = new OpenAPIHandler(quotesORPCRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      schemaConverters: [new ZodToJsonSchemaConverter()],
      specGenerateOptions: {
        info: {
          title: "Bioalergia Quotes oRPC",
          description: "Contratos oRPC/OpenAPI para cotizaciones y empresas.",
          version: "1.0.0",
        },
      },
    }),
  ],
  interceptors: [
    onError((error) => {
      logError(error, { module: "api", operation: "openapi.quotes" });
    }),
  ],
});

export type QuotesORPCRouter = typeof quotesORPCRouter;
