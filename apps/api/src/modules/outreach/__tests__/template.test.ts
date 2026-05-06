import { describe, expect, it } from "vitest";
import { renderTemplate } from "../template";

const BASE_EST = {
  rbd: "12345",
  nombre: "Colegio San Patricio",
  tipo: "COLEGIO" as const,
  fuente: "MINEDUC" as const,
  dependencia: "MUNICIPAL" as const,
  comuna: "Concepción",
  ciudad: null,
  region: "Biobío",
  direccion: null,
  telefonoMineduc: null,
  emailMineduc: null,
  directorMineduc: "Ana Gómez",
  matriculaTotal: null,
  rural: false,
  googlePlaceId: null,
  categoria: null,
  dominio: null,
  rating: null,
  totalReviews: null,
  estadoNegocio: null,
  linkedinUrl: null,
  apolloOrgId: null,
  apolloLastFetchedAt: null,
  hunterLastFetchedAt: null,
  hunterEmailPattern: null,
  crawledAt: null,
  crawlSuccess: false,
  websiteUrl: null,
  emailsAdicionales: [],
  telefonosAdicionales: [],
  notas: null,
  score: 0,
  prioridad: "BAJA" as const,
  etiquetas: [],
  estado: "SIN_CONTACTAR" as const,
  ultimoContactoAt: null,
  activo: true,
  importadoEn: new Date(),
  actualizadoEn: new Date(),
};

const BASE_CONTACT = {
  id: 1,
  establecimientoRbd: "12345",
  nombre: "Pedro Rodríguez",
  cargo: "RRHH",
  email: null,
  telefono: null,
  esPrincipal: false,
  notas: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("renderTemplate", () => {
  it("substitutes all known variables", () => {
    const template = "Hola {{nombre_director}}, soy de {{nombre_colegio}} en {{comuna}}.";
    const result = renderTemplate(template, { establishment: BASE_EST, contact: null });
    expect(result).toBe("Hola Ana Gómez, soy de Colegio San Patricio en Concepción.");
  });

  it("uses contact name when provided", () => {
    const template = "Estimado {{nombre_contacto}}";
    const result = renderTemplate(template, { establishment: BASE_EST, contact: BASE_CONTACT });
    expect(result).toBe("Estimado Pedro Rodríguez");
  });

  it("falls back to directorMineduc for nombre_contacto when no contact", () => {
    const template = "Estimado {{nombre_contacto}}";
    const result = renderTemplate(template, { establishment: BASE_EST, contact: null });
    expect(result).toBe("Estimado Ana Gómez");
  });

  it("falls back to generic when no director or contact", () => {
    const template = "{{nombre_director}}";
    const result = renderTemplate(template, {
      establishment: { ...BASE_EST, directorMineduc: null },
      contact: null,
    });
    expect(result).toBe("Director/a");
  });

  it("substitutes rbd and dependencia", () => {
    const template = "RBD: {{rbd}} / {{dependencia}}";
    const result = renderTemplate(template, { establishment: BASE_EST, contact: null });
    expect(result).toBe("RBD: 12345 / Municipal");
  });

  it("is case-insensitive for template vars", () => {
    const template = "{{NOMBRE_COLEGIO}}";
    const result = renderTemplate(template, { establishment: BASE_EST, contact: null });
    expect(result).toBe("Colegio San Patricio");
  });

  it("handles extra spaces inside braces", () => {
    const template = "{{ nombre_colegio  }}";
    const result = renderTemplate(template, { establishment: BASE_EST, contact: null });
    expect(result).toBe("Colegio San Patricio");
  });

  it("returns empty string for empty template", () => {
    expect(renderTemplate("", { establishment: BASE_EST, contact: null })).toBe("");
  });

  it("leaves unknown vars intact", () => {
    const template = "{{unknown_var}} test";
    const result = renderTemplate(template, { establishment: BASE_EST, contact: null });
    expect(result).toBe("{{unknown_var}} test");
  });
});
