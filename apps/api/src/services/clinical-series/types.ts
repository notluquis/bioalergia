// Shared types for the clinical-series module. Extracted from the
// monolithic services/clinical-series.ts so sub-modules can import the
// type vocabulary without pulling the heavy logic graph.

export type ClinicalSeriesKind =
  | "PATCH_TEST"
  | "SKIN_TEST"
  | "SUBCUTANEOUS_TREATMENT"
  | "MEDICAL_CONSULTATION";

export type ClinicalSeriesStageKind = "DOSE" | "INSTALLATION" | "MAINTENANCE" | "READING";

export type SubcutaneousAllergenType = "ACAROS" | "ACAROS_GRAMINEAS" | "GRAMINEAS";

export type SubcutaneousVaccineProduct =
  | "ALXOID"
  | "CLUSTOID"
  | "CLUSTOID_B120"
  | "CLUSTOID_FORTE"
  | "ORAL_TEC";

export type HealthInsuranceType = "FONASA" | "ISAPRE" | "PARTICULAR";

export type DeliveryModality = "DOMICILIO" | "PRESENCIAL";

export type EventSeriesCandidate = {
  amountExpected: null | number;
  amountPaid: null | number;
  beneficiaryName: null | string;
  beneficiaryRut: null | string;
  calendarGoogleId: string;
  category: null | string;
  clinicalSeriesId: null | number;
  description: null | string;
  eventDate: string;
  eventTime: null | string;
  eventId: number;
  externalEventId: string;
  patientName: null | string;
  patientRut: null | string;
  seriesStageKind: ClinicalSeriesStageKind | null;
  seriesStageLabel: null | string;
  seriesStageNumber: null | number;
  summary: null | string;
  testMetadata: null | {
    firstReading: boolean;
    patchTest: boolean;
    secondReading: boolean;
    skinTest: boolean;
    thirdReading: boolean;
  };
  treatmentStage: null | string;
};

export type ClinicalSeriesEventSnapshot = {
  amountExpected: null | number;
  amountPaid: null | number;
  beneficiaryName: null | string;
  beneficiaryRut: null | string;
  calendarGoogleId: string;
  description: null | string;
  dosageUnit: null | string;
  dosageValue: null | number;
  eventDate: string;
  eventTime: null | string;
  eventId: number;
  externalEventId: string;
  linkedDocuments: Array<{
    dteSaleDetailId: string;
    folio: string;
    totalAmount: number;
  }>;
  linkedFolios: string[];
  patientName: null | string;
  patientRut: null | string;
  seriesStageKind: ClinicalSeriesStageKind | null;
  seriesStageLabel: null | string;
  seriesStageNumber: null | number;
  summary: null | string;
};

export type ClinicalSeriesLinkedDocument = {
  clientName: string;
  clientRUT: string;
  confidenceScore: number;
  documentDate: string;
  dteSaleDetailId: string;
  folio: string;
  matchedBy: string;
  totalAmount: number;
};

export interface ClinicalSeriesSnapshot {
  allergenType: null | SubcutaneousAllergenType;
  abandonmentBucket: null | "month_1" | "month_2" | "month_3" | "month_4_plus";
  daysSinceLastEvent: null | number;
  vaccineProduct: null | SubcutaneousVaccineProduct;
  healthInsurance: null | HealthInsuranceType;
  isapreName: null | string;
  deliveryModality: null | DeliveryModality;
  beneficiaryName: null | string;
  beneficiaryPhones: string[];
  beneficiaryRut: null | string;
  displayName: null | string;
  eligibleDocumentDateFrom: string;
  eligibleDocumentDateTo: string;
  events: ClinicalSeriesEventSnapshot[];
  id: number;
  kind: ClinicalSeriesKind;
  lastAbandonmentContact: null | {
    contactedAt: string;
    outcome: "WILL_RETURN" | "DECLINED" | "UNREACHABLE" | "RESCHEDULED" | "OTHER";
  };
  lastEventDate: null | string;
  linkedDocuments: ClinicalSeriesLinkedDocument[];
  nextEventDate: null | string;
  patientName: null | string;
  patientPhones: string[];
  patientRut: null | string;
  remainingExpected: number;
  remainingPaid: number;
  status: "ACTIVE" | "CANCELLED" | "COMPLETED" | "PLANNED" | "INACTIVE";
  totalExpected: number;
  totalLinkedAmount: number;
  totalPaid: number;
  upcomingCount: number;
}

export type ClinicalSeriesFilters = {
  abandonmentBucket?: "month_1" | "month_2" | "month_3" | "month_4_plus";
  beneficiaryRut?: string;
  hasSkinTest?: boolean;
  healthInsurance?: HealthInsuranceType;
  isapreOnlyUnidentified?: boolean;
  isapreProvider?: string;
  kind?: ClinicalSeriesKind;
  lastVisitFrom?: string;
  lastVisitTo?: string;
  nextVisitFrom?: string;
  nextVisitTo?: string;
  page?: number;
  pageSize?: number;
  patientPhone?: string;
  query?: string;
  patientName?: string;
  patientRut?: string;
  sortColumn?:
    | "daysSinceLastEvent"
    | "financial"
    | "kind"
    | "lastEvent"
    | "nextEvent"
    | "patient"
    | "status"
    | "totalEvents"
    | "upcomingEvents";
  sortDirection?: "ascending" | "descending";
  status?: "ACTIVE" | "CANCELLED" | "COMPLETED" | "PLANNED" | "INACTIVE";
  view?: "abandonment" | "series";
};

export type ClinicalSeriesInsuranceStats = {
  fonasa: number;
  isapre: number;
  isapreProviders: Array<{ providerName: string; total: number }>;
  isapreUnidentified: number;
  particular: number;
  total: number;
  unidentified: number;
};

export type StructuredClinicalDescription = {
  beneficiaryCandidates: Array<{ name: null | string; rut: string }>;
  beneficiaryRuts: string[];
  boletaBlock: null | string;
  commune: null | string;
  contactPhone: null | string;
  consultationReason: null | string;
  diseases: null | string;
  email: null | string;
  evolution: null | string;
  healthInsurance: null | string;
  patientRut: null | string;
};

export type ClinicalIdentity = {
  beneficiaryName: null | string;
  beneficiaryRut: null | string;
  patientName: null | string;
  patientRut: null | string;
};

export type StoredClinicalIdentity = {
  beneficiaryName?: null | string;
  beneficiaryRut?: null | string;
  patientName?: null | string;
  patientRut?: null | string;
};

export type InsuranceResolution = {
  healthInsurance: HealthInsuranceType | null;
  isapreName: null | string;
};

export type InsuranceEventLike = {
  description: null | string;
  eventDate?: null | string;
  eventId?: null | number;
  id?: null | number;
  startDate?: Date | null;
  startDateTime?: Date | null;
  summary: null | string;
};

export type IdentityNameCounts = Map<string, { count: number; name: string }>;

export interface ClinicalSeriesDuplicate {
  confidence: "high" | "medium";
  kind: ClinicalSeriesKind;
  patientName: null | string;
  reason: string;
  sourceEventCount: number;
  sourceId: number;
  sourcePatientName: null | string;
  sourcePatientRut: null | string;
  targetEventCount: number;
  targetId: number;
}
