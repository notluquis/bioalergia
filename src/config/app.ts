export const APP_CONFIG = {
  name: "Bioalergia",
  companyLegalName: "Bioalergia SpA",
  // Add other global constants here
  version: "1.0.0",
} as const;

export type AppConfig = typeof APP_CONFIG;
