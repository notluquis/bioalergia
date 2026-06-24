/**
 * Smoke test del generador de PDF de cotización: produce un PDF válido (header
 * %PDF), embebe la fuente (no debe tirar), y maneja descuentos/exentos/multipágina
 * sin reventar. No valida pixeles — sólo que el pipeline corre end-to-end.
 */
import type { QuoteDto } from "@finanzas/orpc-contracts/quotes";
import { describe, expect, it } from "vitest";
import { generateQuotePdf, type QuotePdfClinic } from "./quote-pdf.service.ts";

const clinic: QuotePdfClinic = {
  name: "Bioalergia",
  legalName: "DR. JOSE MANUEL MARTINEZ Y COMPAÑIA LIMITADA",
  legalRut: "76.406.172-1",
  address: "San Martín 870, Concepción",
  phoneWhatsapp: "+569 30963316",
  phoneLandline: "(41) 33355293",
  email: "contacto@bioalergia.cl",
  logoUrl: null,
};

function makeQuote(overrides?: Partial<QuoteDto>): QuoteDto {
  return {
    id: 1,
    folio: 46,
    companyId: 1,
    contactId: null,
    createdById: 1,
    createdByName: "Pamela Marín",
    issueDate: new Date("2026-06-01"),
    dueDate: new Date("2026-06-08"),
    condicionPago: "CRÉDITO 7 DÍAS",
    status: "SENT",
    subtotal: 38500,
    discount: 0,
    taxRate: 19,
    taxAmount: 7315,
    total: 45815,
    comments: "Comentario de prueba · ñ á é í ó ú",
    notes: null,
    company: {
      id: 1,
      razonSocial: "Centro de diagnóstico CDs",
      rut: "76.939.006-5",
      giro: "Servicios médicos",
      direccion: "San Martín 940",
      comuna: "Concepción",
      ciudad: "Concepción",
      email: "x@y.cl",
      phone: "+56 9 5406 9116",
      condicionPago: "CRÉDITO 7 DÍAS",
      notes: null,
      isActive: true,
      contacts: [],
    },
    contact: null,
    items: [
      {
        id: 1,
        productId: 1,
        code: "G203",
        brand: "DIATER",
        category: "Gramínea",
        description: "Cynodon dactylon / Pasto bermuda",
        format: "2 mL",
        quantity: 1,
        unitPrice: 38500,
        discount: 0,
        exempt: false,
        subtotal: 38500,
        sortOrder: 0,
      },
    ],
    createdAt: new Date("2026-06-01"),
    updatedAt: new Date("2026-06-01"),
    ...overrides,
  };
}

const PDF_MAGIC = "%PDF";

async function assertValidPdf(bytes: Uint8Array) {
  expect(bytes).toBeInstanceOf(Uint8Array);
  expect(bytes.length).toBeGreaterThan(1000);
  expect(Buffer.from(bytes.slice(0, 4)).toString("latin1")).toBe(PDF_MAGIC);
}

describe("generateQuotePdf", () => {
  it("genera un PDF válido con fuente embebida", async () => {
    await assertValidPdf(await generateQuotePdf({ clinic, quote: makeQuote() }));
  });

  it("maneja descuento, exentos y contacto", async () => {
    const quote = makeQuote({
      discount: 5000,
      contact: {
        id: 9,
        companyId: 1,
        personId: null,
        name: "Claudia",
        email: null,
        phone: null,
        role: "Solicitante",
      },
      items: [
        {
          id: 1,
          productId: null,
          code: null,
          brand: null,
          category: null,
          description: "Línea exenta",
          format: null,
          quantity: 2,
          unitPrice: 10000,
          discount: 0,
          exempt: true,
          subtotal: 20000,
          sortOrder: 0,
        },
        {
          id: 2,
          productId: 1,
          code: "T526",
          brand: "ALLOS",
          category: "Árbol",
          description: "Olea europea / Olivo",
          format: "2.5 mL",
          quantity: 1,
          unitPrice: 38500,
          discount: 2000,
          exempt: false,
          subtotal: 36500,
          sortOrder: 1,
        },
      ],
    });
    await assertValidPdf(await generateQuotePdf({ clinic, quote }));
  });

  it("pagina cuando hay muchas líneas", async () => {
    const items = Array.from({ length: 40 }, (_, i) => ({
      id: i + 1,
      productId: 1,
      code: `C${i}`,
      brand: "DIATER",
      category: "Gramínea",
      description: `Alérgeno ${i} de prueba con nombre largo`,
      format: "2.5 mL",
      quantity: 1,
      unitPrice: 38500,
      discount: 0,
      exempt: false,
      subtotal: 38500,
      sortOrder: i,
    }));
    await assertValidPdf(await generateQuotePdf({ clinic, quote: makeQuote({ items }) }));
  });
});
