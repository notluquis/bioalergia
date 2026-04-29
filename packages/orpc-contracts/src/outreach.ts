import { oc } from "@orpc/contract";
import { z } from "zod";

// ── Enums ────────────────────────────────────────────────────────────────────

export const outreachDependenciaSchema = z.enum([
  "MUNICIPAL",
  "PARTICULAR_SUBVENCIONADO",
  "PARTICULAR_PAGADO",
  "SLEP",
  "CORPORACION_MUNICIPAL",
  "OTRO",
]);
export type OutreachDependencia = z.infer<typeof outreachDependenciaSchema>;

export const outreachStatusSchema = z.enum([
  "SIN_CONTACTAR",
  "CONTACTADO",
  "SIN_RESPUESTA",
  "RESPONDIO_INTERES",
  "RESPONDIO_MAS_INFO",
  "RESPONDIO_DESISTIO",
  "REUNION_AGENDADA",
  "CONVENIO_FIRMADO",
  "DESCARTADO",
]);
export type OutreachStatus = z.infer<typeof outreachStatusSchema>;

export const outreachPrioritySchema = z.enum(["ALTA", "MEDIA", "BAJA"]);
export type OutreachPriority = z.infer<typeof outreachPrioritySchema>;

export const outreachInteractionTypeSchema = z.enum([
  "EMAIL_ENVIADO",
  "EMAIL_RECIBIDO",
  "LLAMADA_REALIZADA",
  "LLAMADA_RECIBIDA",
  "WHATSAPP",
  "REUNION_PRESENCIAL",
  "REUNION_ONLINE",
  "CHARLA_REALIZADA",
  "NOTA_INTERNA",
]);
export type OutreachInteractionType = z.infer<typeof outreachInteractionTypeSchema>;

export const outreachCampaignStatusSchema = z.enum([
  "BORRADOR",
  "REVISION",
  "ENVIANDO",
  "COMPLETADA",
  "PAUSADA",
  "CANCELADA",
]);
export type OutreachCampaignStatus = z.infer<typeof outreachCampaignStatusSchema>;

export const outreachDeliveryStatusSchema = z.enum([
  "PENDIENTE",
  "ENVIADO",
  "ERROR",
  "REBOTADO",
  "ABIERTO",
  "RESPONDIDO",
]);
export type OutreachDeliveryStatus = z.infer<typeof outreachDeliveryStatusSchema>;

export const outreachProspectTypeSchema = z.enum([
  "COLEGIO",
  "EMPRESA",
  "MUNICIPIO",
  "INSTITUCION",
  "UNIVERSIDAD",
  "OTRO",
]);
export type OutreachProspectType = z.infer<typeof outreachProspectTypeSchema>;

export const outreachProspectSourceSchema = z.enum([
  "MINEDUC",
  "GOOGLE_PLACES",
  "CRAWLER",
  "APOLLO",
  "HUNTER",
  "MANUAL",
]);
export type OutreachProspectSource = z.infer<typeof outreachProspectSourceSchema>;

// ── Entities ─────────────────────────────────────────────────────────────────

export const outreachEstablishmentSchema = z.object({
  rbd: z.string(),
  nombre: z.string(),
  tipo: outreachProspectTypeSchema,
  fuente: outreachProspectSourceSchema,
  dependencia: outreachDependenciaSchema,
  comuna: z.string(),
  ciudad: z.string().nullable(),
  region: z.string(),
  direccion: z.string().nullable(),
  telefonoMineduc: z.string().nullable(),
  emailMineduc: z.string().nullable(),
  directorMineduc: z.string().nullable(),
  matriculaTotal: z.number().int().nullable(),
  rural: z.boolean(),
  googlePlaceId: z.string().nullable(),
  categoria: z.string().nullable(),
  dominio: z.string().nullable(),
  rating: z.number().nullable(),
  totalReviews: z.number().int().nullable(),
  estadoNegocio: z.string().nullable(),
  linkedinUrl: z.string().nullable(),
  apolloOrgId: z.string().nullable(),
  apolloLastFetchedAt: z.coerce.date().nullable(),
  hunterLastFetchedAt: z.coerce.date().nullable(),
  hunterEmailPattern: z.string().nullable(),
  crawledAt: z.coerce.date().nullable(),
  crawlSuccess: z.boolean(),
  score: z.number().int(),
  websiteUrl: z.string().nullable(),
  emailsAdicionales: z.array(z.string()),
  telefonosAdicionales: z.array(z.string()),
  notas: z.string().nullable(),
  prioridad: outreachPrioritySchema,
  etiquetas: z.array(z.string()),
  estado: outreachStatusSchema,
  ultimoContactoAt: z.coerce.date().nullable(),
  activo: z.boolean(),
  importadoEn: z.coerce.date(),
  actualizadoEn: z.coerce.date(),
});
export type OutreachEstablishment = z.infer<typeof outreachEstablishmentSchema>;

export const outreachContactSchema = z.object({
  id: z.number().int(),
  establecimientoRbd: z.string(),
  nombre: z.string(),
  cargo: z.string(),
  email: z.string().nullable(),
  telefono: z.string().nullable(),
  esPrincipal: z.boolean(),
  notas: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type OutreachContact = z.infer<typeof outreachContactSchema>;

export const outreachInteractionSchema = z.object({
  id: z.number().int(),
  establecimientoRbd: z.string(),
  contactoId: z.number().int().nullable(),
  tipo: outreachInteractionTypeSchema,
  fecha: z.coerce.date(),
  asunto: z.string().nullable(),
  contenido: z.string(),
  emailDesde: z.string().nullable(),
  emailHacia: z.string().nullable(),
  resultado: z.string().nullable(),
  creadoPorUserId: z.number().int().nullable(),
  creadoPorNombre: z.string().nullable(),
  createdAt: z.coerce.date(),
});
export type OutreachInteraction = z.infer<typeof outreachInteractionSchema>;

export const outreachCampaignFiltersSchema = z.object({
  dependencias: z.array(outreachDependenciaSchema).optional(),
  comunas: z.array(z.string()).optional(),
  estados: z.array(outreachStatusSchema).optional(),
  prioridades: z.array(outreachPrioritySchema).optional(),
  etiquetas: z.array(z.string()).optional(),
  soloConEmail: z.boolean().optional(),
  excludeRbds: z.array(z.string()).optional(),
});
export type OutreachCampaignFilters = z.infer<typeof outreachCampaignFiltersSchema>;

export const outreachCampaignSchema = z.object({
  id: z.number().int(),
  nombre: z.string(),
  asunto: z.string(),
  cuerpoHtml: z.string(),
  cuerpoTexto: z.string(),
  fromEmail: z.string(),
  fromNombre: z.string(),
  replyTo: z.string().nullable(),
  filtros: outreachCampaignFiltersSchema,
  ratePerHour: z.number().int(),
  estado: outreachCampaignStatusSchema,
  totalDestinatarios: z.number().int(),
  enviados: z.number().int(),
  errores: z.number().int(),
  respondidos: z.number().int(),
  createdByUserId: z.number().int().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  enviadoEn: z.coerce.date().nullable(),
});
export type OutreachCampaign = z.infer<typeof outreachCampaignSchema>;

export const outreachDeliverySchema = z.object({
  id: z.number().int(),
  campaignId: z.number().int(),
  establecimientoRbd: z.string(),
  contactoId: z.number().int().nullable(),
  emailDestinatario: z.string(),
  asuntoRender: z.string().nullable(),
  cuerpoHtmlRender: z.string().nullable(),
  cuerpoTextoRender: z.string().nullable(),
  estado: outreachDeliveryStatusSchema,
  errorMensaje: z.string().nullable(),
  intentos: z.number().int(),
  enviadoEn: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type OutreachDelivery = z.infer<typeof outreachDeliverySchema>;

export const outreachImportLogSchema = z.object({
  id: z.number().int(),
  source: z.string(),
  fileUrl: z.string().nullable(),
  totalRows: z.number().int(),
  nuevos: z.number().int(),
  actualizados: z.number().int(),
  inactivos: z.number().int(),
  errores: z.number().int(),
  errorDetalle: z.string().nullable(),
  startedAt: z.coerce.date(),
  finishedAt: z.coerce.date().nullable(),
  createdByUserId: z.number().int().nullable(),
});
export type OutreachImportLog = z.infer<typeof outreachImportLogSchema>;

// ── Establishments inputs ───────────────────────────────────────────────────

export const listEstablishmentsInputSchema = z.object({
  search: z.string().optional(),
  tipos: z.array(outreachProspectTypeSchema).optional(),
  fuentes: z.array(outreachProspectSourceSchema).optional(),
  estados: z.array(outreachStatusSchema).optional(),
  dependencias: z.array(outreachDependenciaSchema).optional(),
  comunas: z.array(z.string()).optional(),
  ciudades: z.array(z.string()).optional(),
  prioridades: z.array(outreachPrioritySchema).optional(),
  soloConEmail: z.boolean().optional(),
  soloActivos: z.boolean().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(200).default(50),
  sortBy: z
    .enum([
      "nombre",
      "comuna",
      "estado",
      "prioridad",
      "ultimoContactoAt",
      "matriculaTotal",
      "score",
    ])
    .default("nombre"),
  sortDir: z.enum(["asc", "desc"]).default("asc"),
});
export type ListEstablishmentsInput = z.infer<typeof listEstablishmentsInputSchema>;

export const establishmentRbdInputSchema = z.object({
  rbd: z.string().min(1).max(20),
});

export const updateEstablishmentInputSchema = z.object({
  rbd: z.string().min(1).max(20),
  websiteUrl: z.string().nullable().optional(),
  emailsAdicionales: z.array(z.string()).optional(),
  telefonosAdicionales: z.array(z.string()).optional(),
  notas: z.string().nullable().optional(),
  prioridad: outreachPrioritySchema.optional(),
  etiquetas: z.array(z.string()).optional(),
  estado: outreachStatusSchema.optional(),
});

export const bulkUpdateEstablishmentsInputSchema = z.object({
  rbds: z.array(z.string()).min(1),
  estado: outreachStatusSchema.optional(),
  prioridad: outreachPrioritySchema.optional(),
  agregarEtiqueta: z.string().optional(),
  removerEtiqueta: z.string().optional(),
});

// ── Contacts inputs ──────────────────────────────────────────────────────────

export const upsertContactInputSchema = z.object({
  id: z.number().int().positive().optional(),
  establecimientoRbd: z.string().min(1).max(20),
  nombre: z.string().min(1).max(200),
  cargo: z.string().min(1).max(200),
  email: z.string().email().nullable().optional(),
  telefono: z.string().max(50).nullable().optional(),
  esPrincipal: z.boolean().optional(),
  notas: z.string().max(2000).nullable().optional(),
});

export const contactIdInputSchema = z.object({ id: z.number().int().positive() });

// ── Interactions inputs ─────────────────────────────────────────────────────

export const createInteractionInputSchema = z.object({
  establecimientoRbd: z.string().min(1).max(20),
  contactoId: z.number().int().positive().nullable().optional(),
  tipo: outreachInteractionTypeSchema,
  fecha: z.coerce.date(),
  asunto: z.string().max(500).nullable().optional(),
  contenido: z.string().min(1).max(20000),
  emailDesde: z.string().nullable().optional(),
  emailHacia: z.string().nullable().optional(),
  resultado: z.string().max(500).nullable().optional(),
});

export const interactionIdInputSchema = z.object({ id: z.number().int().positive() });

// ── Campaign inputs ─────────────────────────────────────────────────────────

export const createCampaignInputSchema = z.object({
  nombre: z.string().min(1).max(200),
  asunto: z.string().min(1).max(500),
  cuerpoHtml: z.string().min(1),
  cuerpoTexto: z.string().min(1),
  fromEmail: z.string().email(),
  fromNombre: z.string().min(1).max(200),
  replyTo: z.string().email().nullable().optional(),
  filtros: outreachCampaignFiltersSchema.optional(),
  ratePerHour: z.number().int().min(1).max(500).optional(),
});

export const updateCampaignInputSchema = createCampaignInputSchema.partial().extend({
  id: z.number().int().positive(),
});

export const campaignIdInputSchema = z.object({ id: z.number().int().positive() });

export const previewCampaignInputSchema = z.object({
  filtros: outreachCampaignFiltersSchema,
  asunto: z.string(),
  cuerpoHtml: z.string(),
  cuerpoTexto: z.string(),
  sampleRbd: z.string().optional(),
});

export const launchCampaignInputSchema = z.object({
  id: z.number().int().positive(),
});

export const nextDeliveryBatchInputSchema = z.object({
  campaignId: z.number().int().positive(),
  limit: z.number().int().min(1).max(100).default(10),
});

export const deliveryBatchItemSchema = z.object({
  deliveryId: z.number().int(),
  emailDestinatario: z.string(),
  asunto: z.string(),
  cuerpoHtml: z.string(),
  cuerpoTexto: z.string(),
  fromEmail: z.string(),
  fromNombre: z.string(),
  replyTo: z.string().nullable(),
  establecimientoNombre: z.string(),
});

export const recordDeliveryResultInputSchema = z.object({
  deliveryId: z.number().int().positive(),
  status: z.enum(["ENVIADO", "ERROR"]),
  errorMensaje: z.string().nullable().optional(),
});

// ── Discovery / enrichment inputs ───────────────────────────────────────────

export const zonaSchema = z.object({
  ciudad: z.string(),
  nombre: z.string(),
  lat: z.number(),
  lng: z.number(),
  radio: z.number().int(),
});
export type Zona = z.infer<typeof zonaSchema>;

export const discoverGooglePlacesInputSchema = z.object({
  zonaIndex: z.number().int().min(0).optional(),
  customZona: zonaSchema.optional(),
  ciudad: z.string().optional(),
  region: z.string().optional(),
  type: z.string().optional(),
  textQuery: z.string().optional(),
  maxResults: z.number().int().min(1).max(60).default(20),
});

export const crawlProspectInputSchema = z.object({ rbd: z.string() });
export const apolloEnrichInputSchema = z.object({ rbd: z.string() });
export const hunterDomainInputSchema = z.object({ rbd: z.string() });
export const hunterVerifyEmailInputSchema = z.object({ email: z.string().email() });
export const recomputeScoreInputSchema = z.object({ rbd: z.string() });

export const discoverGooglePlacesResponseSchema = z.object({
  found: z.number().int(),
  inserted: z.number().int(),
  updated: z.number().int(),
  errors: z.number().int(),
  prospectIds: z.array(z.string()),
});

export const crawlProspectResponseSchema = z.object({
  url: z.string(),
  emails: z.array(z.string()),
  phones: z.array(z.string()),
  social: z.object({
    linkedin: z.string().optional(),
    instagram: z.string().optional(),
    facebook: z.string().optional(),
    twitter: z.string().optional(),
  }),
  rrhhSnippets: z.array(z.string()),
  success: z.boolean(),
  pagesVisited: z.number().int(),
  error: z.string().nullable(),
});

export const apolloEnrichResponseSchema = z.object({
  contactsCreated: z.number().int(),
  organizationName: z.string().nullable(),
  apolloOrgId: z.string().nullable(),
  peopleFound: z.number().int(),
});

export const hunterDomainResponseSchema = z.object({
  domain: z.string(),
  pattern: z.string().nullable(),
  organization: z.string().nullable(),
  contactsCreated: z.number().int(),
  emailsFound: z.number().int(),
});

export const hunterVerifyResponseSchema = z.object({
  email: z.string(),
  result: z.string(),
  score: z.number(),
  status: z.string(),
  smtp_check: z.boolean(),
  disposable: z.boolean(),
  webmail: z.boolean(),
});

export const scoreResponseSchema = z.object({ score: z.number().int() });

export const zonasResponseSchema = z.object({
  zonas: z.array(zonaSchema),
  categorias: z.array(z.string()),
});

// ── Import inputs ───────────────────────────────────────────────────────────

export const importMineducInputSchema = z.object({
  source: z.enum(["url", "upload"]).default("url"),
  url: z.string().url().optional(),
  csvBase64: z.string().optional(),
  comunas: z.array(z.string()).optional(),
  dryRun: z.boolean().optional(),
});

// ── Outputs ─────────────────────────────────────────────────────────────────

export const establishmentListItemSchema = outreachEstablishmentSchema.extend({
  contactosCount: z.number().int(),
  interaccionesCount: z.number().int(),
  ultimaInteraccionAt: z.coerce.date().nullable(),
});

export const listEstablishmentsResponseSchema = z.object({
  items: z.array(establishmentListItemSchema),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
});

export const establishmentDetailResponseSchema = z.object({
  establishment: outreachEstablishmentSchema,
  contactos: z.array(outreachContactSchema),
  interacciones: z.array(outreachInteractionSchema),
  envios: z.array(outreachDeliverySchema),
});

export const establishmentResponseSchema = z.object({
  establishment: outreachEstablishmentSchema,
});

export const contactResponseSchema = z.object({ contacto: outreachContactSchema });
export const interactionResponseSchema = z.object({ interaccion: outreachInteractionSchema });

export const campaignResponseSchema = z.object({ campaign: outreachCampaignSchema });

export const listCampaignsResponseSchema = z.object({
  campaigns: z.array(outreachCampaignSchema),
});

export const campaignDetailResponseSchema = z.object({
  campaign: outreachCampaignSchema,
  envios: z.array(outreachDeliverySchema),
});

export const campaignPreviewResponseSchema = z.object({
  totalCandidatos: z.number().int(),
  conEmail: z.number().int(),
  sinEmail: z.number().int(),
  rendered: z.object({
    asunto: z.string(),
    cuerpoHtml: z.string(),
    cuerpoTexto: z.string(),
    establecimiento: outreachEstablishmentSchema.nullable(),
  }),
  destinatarios: z.array(
    z.object({
      rbd: z.string(),
      nombre: z.string(),
      comuna: z.string(),
      email: z.string().nullable(),
    }),
  ),
});

export const importMineducResponseSchema = z.object({
  log: outreachImportLogSchema,
});

export const nextDeliveryBatchResponseSchema = z.object({
  items: z.array(deliveryBatchItemSchema),
  remaining: z.number().int(),
});

export const dashboardResponseSchema = z.object({
  totales: z.object({
    establecimientos: z.number().int(),
    activos: z.number().int(),
    conEmail: z.number().int(),
  }),
  porEstado: z.array(z.object({ estado: outreachStatusSchema, count: z.number().int() })),
  porDependencia: z.array(
    z.object({ dependencia: outreachDependenciaSchema, count: z.number().int() }),
  ),
  porComuna: z.array(z.object({ comuna: z.string(), count: z.number().int() })),
  pendientesSeguimiento: z.number().int(),
  ultimasInteracciones: z.array(
    outreachInteractionSchema.extend({ establishmentNombre: z.string() }),
  ),
});

export const filtersResponseSchema = z.object({
  comunas: z.array(z.string()),
  etiquetas: z.array(z.string()),
});

export const okResponseSchema = z.object({ status: z.literal("ok") });

// ── Contract ────────────────────────────────────────────────────────────────

export const outreachContract = {
  // Establecimientos
  listEstablishments: oc
    .route({ method: "POST", path: "/establishments/list", tags: ["Outreach"] })
    .input(listEstablishmentsInputSchema)
    .output(listEstablishmentsResponseSchema),
  getEstablishment: oc
    .route({ method: "POST", path: "/establishments/get", tags: ["Outreach"] })
    .input(establishmentRbdInputSchema)
    .output(establishmentDetailResponseSchema),
  updateEstablishment: oc
    .route({ method: "POST", path: "/establishments/update", tags: ["Outreach"] })
    .input(updateEstablishmentInputSchema)
    .output(establishmentResponseSchema),
  bulkUpdateEstablishments: oc
    .route({ method: "POST", path: "/establishments/bulk-update", tags: ["Outreach"] })
    .input(bulkUpdateEstablishmentsInputSchema)
    .output(z.object({ updated: z.number().int() })),
  filtersMeta: oc
    .route({ method: "GET", path: "/filters", tags: ["Outreach"] })
    .input(z.object({}).optional())
    .output(filtersResponseSchema),

  // Contactos
  upsertContact: oc
    .route({ method: "POST", path: "/contacts/upsert", tags: ["Outreach"] })
    .input(upsertContactInputSchema)
    .output(contactResponseSchema),
  deleteContact: oc
    .route({ method: "POST", path: "/contacts/delete", tags: ["Outreach"] })
    .input(contactIdInputSchema)
    .output(okResponseSchema),

  // Interacciones
  createInteraction: oc
    .route({ method: "POST", path: "/interactions/create", tags: ["Outreach"] })
    .input(createInteractionInputSchema)
    .output(interactionResponseSchema),
  deleteInteraction: oc
    .route({ method: "POST", path: "/interactions/delete", tags: ["Outreach"] })
    .input(interactionIdInputSchema)
    .output(okResponseSchema),

  // Campañas
  listCampaigns: oc
    .route({ method: "GET", path: "/campaigns", tags: ["Outreach"] })
    .input(z.object({}).optional())
    .output(listCampaignsResponseSchema),
  getCampaign: oc
    .route({ method: "POST", path: "/campaigns/get", tags: ["Outreach"] })
    .input(campaignIdInputSchema)
    .output(campaignDetailResponseSchema),
  createCampaign: oc
    .route({ method: "POST", path: "/campaigns/create", tags: ["Outreach"] })
    .input(createCampaignInputSchema)
    .output(campaignResponseSchema),
  updateCampaign: oc
    .route({ method: "POST", path: "/campaigns/update", tags: ["Outreach"] })
    .input(updateCampaignInputSchema)
    .output(campaignResponseSchema),
  deleteCampaign: oc
    .route({ method: "POST", path: "/campaigns/delete", tags: ["Outreach"] })
    .input(campaignIdInputSchema)
    .output(okResponseSchema),
  previewCampaign: oc
    .route({ method: "POST", path: "/campaigns/preview", tags: ["Outreach"] })
    .input(previewCampaignInputSchema)
    .output(campaignPreviewResponseSchema),
  launchCampaign: oc
    .route({ method: "POST", path: "/campaigns/launch", tags: ["Outreach"] })
    .input(launchCampaignInputSchema)
    .output(campaignResponseSchema),
  pauseCampaign: oc
    .route({ method: "POST", path: "/campaigns/pause", tags: ["Outreach"] })
    .input(campaignIdInputSchema)
    .output(campaignResponseSchema),
  nextDeliveryBatch: oc
    .route({ method: "POST", path: "/campaigns/next-batch", tags: ["Outreach"] })
    .input(nextDeliveryBatchInputSchema)
    .output(nextDeliveryBatchResponseSchema),
  recordDeliveryResult: oc
    .route({ method: "POST", path: "/campaigns/record-result", tags: ["Outreach"] })
    .input(recordDeliveryResultInputSchema)
    .output(okResponseSchema),

  // Importación
  importMineduc: oc
    .route({ method: "POST", path: "/import/mineduc", tags: ["Outreach"] })
    .input(importMineducInputSchema)
    .output(importMineducResponseSchema),

  // Descubrimiento + enriquecimiento
  zonas: oc
    .route({ method: "GET", path: "/zonas", tags: ["Outreach"] })
    .input(z.object({}).optional())
    .output(zonasResponseSchema),
  discoverGooglePlaces: oc
    .route({ method: "POST", path: "/discover/google-places", tags: ["Outreach"] })
    .input(discoverGooglePlacesInputSchema)
    .output(discoverGooglePlacesResponseSchema),
  crawlProspect: oc
    .route({ method: "POST", path: "/enrich/crawl", tags: ["Outreach"] })
    .input(crawlProspectInputSchema)
    .output(crawlProspectResponseSchema),
  apolloEnrich: oc
    .route({ method: "POST", path: "/enrich/apollo", tags: ["Outreach"] })
    .input(apolloEnrichInputSchema)
    .output(apolloEnrichResponseSchema),
  hunterDomain: oc
    .route({ method: "POST", path: "/enrich/hunter-domain", tags: ["Outreach"] })
    .input(hunterDomainInputSchema)
    .output(hunterDomainResponseSchema),
  hunterVerifyEmail: oc
    .route({ method: "POST", path: "/enrich/hunter-verify", tags: ["Outreach"] })
    .input(hunterVerifyEmailInputSchema)
    .output(hunterVerifyResponseSchema),
  recomputeScore: oc
    .route({ method: "POST", path: "/enrich/recompute-score", tags: ["Outreach"] })
    .input(recomputeScoreInputSchema)
    .output(scoreResponseSchema),

  // Dashboard
  dashboard: oc
    .route({ method: "GET", path: "/dashboard", tags: ["Outreach"] })
    .input(z.object({}).optional())
    .output(dashboardResponseSchema),
};

export type OutreachContract = typeof outreachContract;
