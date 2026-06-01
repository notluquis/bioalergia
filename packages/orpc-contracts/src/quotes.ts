import { oc } from "@orpc/contract";
import { z } from "zod";

/**
 * Cotizaciones (Quotes) — documento comercial B2B estilo factura/guía de
 * despacho. El EMISOR (Bioalergia) sale de `ClinicSettings` (singleton, sin
 * hardcode). El CLIENTE es una `Company` (razón social, RUT, giro, …) con
 * contactos/solicitantes. Las líneas se eligen de un catálogo editable
 * (`QuoteProduct`) y se persisten como SNAPSHOT en `QuoteItem` (editar el
 * catálogo no altera cotizaciones históricas). El vendedor = usuario que crea.
 */

export const idInputSchema = z.object({ id: z.number().int() });
export const okResponseSchema = z.object({ ok: z.literal(true) });

// ── Company / contactos ──────────────────────────────────────────────
export const companyContactSchema = z.object({
  id: z.number().int(),
  companyId: z.number().int(),
  personId: z.number().int().nullable(),
  name: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  role: z.string().nullable(),
});

export const companyContactInputSchema = z.object({
  personId: z.number().int().nullable().optional(),
  name: z.string().min(1),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  role: z.string().nullable().optional(),
});

export const companySchema = z.object({
  id: z.number().int(),
  razonSocial: z.string(),
  rut: z.string().nullable(),
  giro: z.string().nullable(),
  direccion: z.string().nullable(),
  comuna: z.string().nullable(),
  ciudad: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  condicionPago: z.string().nullable(),
  notes: z.string().nullable(),
  isActive: z.boolean(),
  contacts: z.array(companyContactSchema),
});

export const createCompanyInputSchema = z.object({
  razonSocial: z.string().min(1),
  rut: z.string().nullable().optional(),
  giro: z.string().nullable().optional(),
  direccion: z.string().nullable().optional(),
  comuna: z.string().nullable().optional(),
  ciudad: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  condicionPago: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  isActive: z.boolean().default(true),
  contacts: z.array(companyContactInputSchema).optional(),
});

export const updateCompanyInputSchema = createCompanyInputSchema.partial().extend({
  id: z.number().int(),
});

export const companyListInputSchema = z.object({ q: z.string().optional() }).optional();
export const companyListResponseSchema = z.object({ companies: z.array(companySchema) });
export const companyResponseSchema = z.object({ company: companySchema });

// ── Catálogo de productos cotizables ─────────────────────────────────
export const quoteProductSchema = z.object({
  id: z.number().int(),
  code: z.string().nullable(),
  brand: z.string().nullable(),
  category: z.string().nullable(),
  name: z.string(),
  format: z.string().nullable(),
  unitPrice: z.number(),
  isActive: z.boolean(),
  sortOrder: z.number().int(),
});

export const createQuoteProductInputSchema = z.object({
  code: z.string().nullable().optional(),
  brand: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  name: z.string().min(1),
  format: z.string().nullable().optional(),
  unitPrice: z.number().min(0),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(0),
});

export const updateQuoteProductInputSchema = createQuoteProductInputSchema.partial().extend({
  id: z.number().int(),
});

export const quoteProductListResponseSchema = z.object({
  products: z.array(quoteProductSchema),
});
export const quoteProductResponseSchema = z.object({ product: quoteProductSchema });

// ── Cotización ───────────────────────────────────────────────────────
export const quoteStatusSchema = z.enum(["DRAFT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED"]);

export const quoteItemInputSchema = z.object({
  productId: z.number().int().nullable().optional(),
  code: z.string().nullable().optional(),
  brand: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  description: z.string().min(1),
  format: z.string().nullable().optional(),
  quantity: z.number().min(0),
  unitPrice: z.number().min(0),
  discount: z.number().min(0).default(0),
  exempt: z.boolean().default(false),
});

export const quoteItemSchema = z.object({
  id: z.number().int(),
  productId: z.number().int().nullable(),
  code: z.string().nullable(),
  brand: z.string().nullable(),
  category: z.string().nullable(),
  description: z.string(),
  format: z.string().nullable(),
  quantity: z.number(),
  unitPrice: z.number(),
  discount: z.number(),
  exempt: z.boolean(),
  subtotal: z.number(),
  sortOrder: z.number().int(),
});

export const quoteSchema = z.object({
  id: z.number().int(),
  folio: z.number().int(),
  companyId: z.number().int(),
  contactId: z.number().int().nullable(),
  createdById: z.number().int().nullable(),
  createdByName: z.string().nullable(),
  issueDate: z.coerce.date(),
  dueDate: z.coerce.date().nullable(),
  condicionPago: z.string().nullable(),
  status: quoteStatusSchema,
  subtotal: z.number(),
  discount: z.number(),
  taxRate: z.number(),
  taxAmount: z.number(),
  total: z.number(),
  comments: z.string().nullable(),
  notes: z.string().nullable(),
  company: companySchema,
  contact: companyContactSchema.nullable(),
  items: z.array(quoteItemSchema),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

// Fila resumida para la lista (sin items ni company completa).
export const quoteListItemSchema = z.object({
  id: z.number().int(),
  folio: z.number().int(),
  companyId: z.number().int(),
  companyName: z.string(),
  issueDate: z.coerce.date(),
  status: quoteStatusSchema,
  total: z.number(),
  createdByName: z.string().nullable(),
});

export const createQuoteInputSchema = z.object({
  companyId: z.number().int(),
  contactId: z.number().int().nullable().optional(),
  issueDate: z.string().optional(),
  dueDate: z.string().nullable().optional(),
  condicionPago: z.string().nullable().optional(),
  taxRate: z.number().min(0).max(100).default(19),
  discount: z.number().min(0).default(0),
  comments: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  status: quoteStatusSchema.optional(),
  items: z.array(quoteItemInputSchema).min(1),
});

export const updateQuoteInputSchema = createQuoteInputSchema.partial().extend({
  id: z.number().int(),
});

export const quoteListInputSchema = z
  .object({ companyId: z.number().int().optional(), q: z.string().optional() })
  .optional();
export const quoteListResponseSchema = z.object({ quotes: z.array(quoteListItemSchema) });
export const quoteResponseSchema = z.object({ quote: quoteSchema });

// ── Contract ─────────────────────────────────────────────────────────
export const quotesContract = {
  // Empresas (cliente)
  listCompanies: oc
    .route({ method: "GET", path: "/companies" })
    .input(companyListInputSchema)
    .output(companyListResponseSchema),
  getCompany: oc
    .route({ method: "GET", path: "/companies/{id}" })
    .input(idInputSchema)
    .output(companyResponseSchema),
  createCompany: oc
    .route({ method: "POST", path: "/companies" })
    .input(createCompanyInputSchema)
    .output(companyResponseSchema),
  updateCompany: oc
    .route({ method: "POST", path: "/companies/{id}/update" })
    .input(updateCompanyInputSchema)
    .output(companyResponseSchema),
  deleteCompany: oc
    .route({ method: "DELETE", path: "/companies/{id}" })
    .input(idInputSchema)
    .output(okResponseSchema),

  // Catálogo de productos
  listQuoteProducts: oc
    .route({ method: "GET", path: "/products" })
    .output(quoteProductListResponseSchema),
  createQuoteProduct: oc
    .route({ method: "POST", path: "/products" })
    .input(createQuoteProductInputSchema)
    .output(quoteProductResponseSchema),
  updateQuoteProduct: oc
    .route({ method: "POST", path: "/products/{id}/update" })
    .input(updateQuoteProductInputSchema)
    .output(quoteProductResponseSchema),
  deleteQuoteProduct: oc
    .route({ method: "DELETE", path: "/products/{id}" })
    .input(idInputSchema)
    .output(okResponseSchema),

  // Cotizaciones
  listQuotes: oc
    .route({ method: "GET", path: "/quotes" })
    .input(quoteListInputSchema)
    .output(quoteListResponseSchema),
  getQuote: oc
    .route({ method: "GET", path: "/quotes/{id}" })
    .input(idInputSchema)
    .output(quoteResponseSchema),
  createQuote: oc
    .route({ method: "POST", path: "/quotes" })
    .input(createQuoteInputSchema)
    .output(quoteResponseSchema),
  updateQuote: oc
    .route({ method: "POST", path: "/quotes/{id}/update" })
    .input(updateQuoteInputSchema)
    .output(quoteResponseSchema),
  deleteQuote: oc
    .route({ method: "DELETE", path: "/quotes/{id}" })
    .input(idInputSchema)
    .output(okResponseSchema),
  generatePdf: oc
    .route({ method: "POST", path: "/quotes/{id}/pdf" })
    .input(idInputSchema)
    .output(z.file()),
};

export type QuotesContract = typeof quotesContract;
export type CompanyDto = z.infer<typeof companySchema>;
export type CompanyContactDto = z.infer<typeof companyContactSchema>;
export type CreateCompanyInput = z.infer<typeof createCompanyInputSchema>;
export type UpdateCompanyInput = z.infer<typeof updateCompanyInputSchema>;
export type QuoteProductDto = z.infer<typeof quoteProductSchema>;
export type CreateQuoteProductInput = z.infer<typeof createQuoteProductInputSchema>;
export type UpdateQuoteProductInput = z.infer<typeof updateQuoteProductInputSchema>;
export type QuoteDto = z.infer<typeof quoteSchema>;
export type QuoteListItemDto = z.infer<typeof quoteListItemSchema>;
export type QuoteItemInput = z.infer<typeof quoteItemInputSchema>;
export type CreateQuoteInput = z.infer<typeof createQuoteInputSchema>;
export type UpdateQuoteInput = z.infer<typeof updateQuoteInputSchema>;
export type QuoteStatus = z.infer<typeof quoteStatusSchema>;
