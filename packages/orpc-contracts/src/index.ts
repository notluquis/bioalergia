export * from "./account.ts";
export * from "./addresses.ts";
export * from "./attendance.ts";
export * from "./site-auth.ts";
export * from "./shipments.ts";
export * from "./auth.ts";
export * from "./balances.ts";
export * from "./backups.ts";
export * from "./calendar.ts";
export * from "./cart.ts";
export * from "./catalog.ts";
export * from "./site-content.ts";
export * from "./certificates.ts";
export * from "./checkout.ts";
export * from "./clinical-records.ts";
export * from "./clinical-series.ts";
export * from "./clinical-skin-tests.ts";
export * from "./onedrive.ts";
export * from "./counterparts.ts";
export * from "./csv-upload.ts";
export * from "./dte.ts";
export * from "./dte-event-links.ts";
export * from "./dte-analytics.ts";
export * from "./exam-reports.ts";
export * from "./email.ts";
export * from "./employees.ts";
export * from "./expenses.ts";
export * from "./finance.ts";
export * from "./haulmer.ts";
export * from "./haulmer-dte.ts";
export * from "./images.ts";
export {
  immunotherapyContract,
  hideableSectionSchema,
  type ImmunotherapyContract,
  type QuoteInput,
  type QuoteResult,
  type CreateBudgetInput,
  type ProductDto,
  type CreateProductInput,
  type UpdateProductInput,
  type HideableSection,
} from "./immunotherapy.ts";
export * from "./inventory.ts";
export * from "./integrations.ts";
export * from "./loans.ts";
export { mlContract, type MlContract } from "./ml.ts";
export * from "./provider-credentials.ts";
export {
  calendarAppointmentsSchema as doctoraliaCalendarAppointmentsSchema,
  doctoraliaContract,
  syncLogsResponseSchema as doctoraliaSyncLogsResponseSchema,
  type DoctoraliaContract,
} from "./doctoralia.ts";
export {
  importChangeSchema as mercadopagoImportChangeSchema,
  importChangesResponseSchema as mercadopagoImportChangesResponseSchema,
  listReportsResponseSchema as mercadopagoListReportsResponseSchema,
  mercadopagoContract,
  mpReportSchema,
  processReportResponseSchema as mercadopagoProcessReportResponseSchema,
  syncLogSchema as mercadopagoSyncLogSchema,
  syncLogsResponseSchema as mercadopagoSyncLogsResponseSchema,
  type MercadopagoContract,
} from "./mercadopago.ts";
export * from "./notifications.ts";
export * from "./outreach.ts";
export { patientsContract, type PatientsContract } from "./patients.ts";
export * from "./patient-campaigns.ts";
export { socialContract, type SocialContract } from "./social.ts";
export * from "./people.ts";
export * from "./personal-finance.ts";
export * from "./job-radar.ts";
export * from "./medications.ts";
export * from "./verification.ts";
export * from "./production-balances.ts";
export * from "./release-transactions.ts";
export * from "./roles.ts";
export * from "./settlement-transactions.ts";
export * from "./supplies.ts";
export { servicesContract, type ServicesContract } from "./services.ts";
export * from "./settings.ts";
export { priceListContract, type PriceListContract } from "./price-list.ts";
export { publicClinicContract, type PublicClinicContract } from "./public-clinic.ts";
export { dataRightsContract, type DataRightsContract } from "./data-rights.ts";
export { breachIncidentsContract, type BreachIncidentsContract } from "./breach-incidents.ts";
export { complaintsContract, type ComplaintsContract } from "./complaints.ts";
export { securityAlertsContract, type SecurityAlertsContract } from "./security-alerts.ts";
export {
  processingActivitiesContract,
  type ProcessingActivitiesContract,
} from "./processing-activities.ts";
export { consentContract, type ConsentContract } from "./consent.ts";
export { clinicalConsentContract, type ClinicalConsentContract } from "./clinical-consent.ts";
export * from "./system.ts";
export * from "./timesheets.ts";
export * from "./transactions-insights.ts";
export * from "./users.ts";
export * from "./utility-bills.ts";
export * from "./wa-cloud.ts";
// Re-export desde el root: el read-only guard del API arma su mapa de métodos
// (read vs mutación) iterando los `*Contract` exportados desde la raíz
// (apps/api/src/lib/orpc-procedure-methods.ts). Sin esto, bajo E2EReadOnly los
// reads de reactivos/alérgenos no se reconocen y fallan cerrado como mutación.
export { reactivosContract, type ReactivosContract } from "./reactivos.ts";
export { pollenContract, type PollenContract } from "./pollen.ts";
export { occupationalContract, type OccupationalContract } from "./occupational.ts";
export { karinContract, type KarinContract } from "./karin.ts";
export { adherenceContract, type AdherenceContract } from "./adherence.ts";
export {
  productDocumentsContract,
  type ProductDocumentsContract,
} from "./product-documents.ts";
export { clinicalAllergensContract, type ClinicalAllergensContract } from "./clinical-allergens.ts";
