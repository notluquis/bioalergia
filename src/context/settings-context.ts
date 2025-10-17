import { createContext, useContext } from "react";
import type { UserRole } from "./auth-context";

export type AppSettings = {
  orgName: string;
  tagline: string;
  primaryColor: string;
  secondaryColor: string;
  logoUrl: string;
  faviconUrl: string;
  dbDisplayHost: string;
  dbDisplayName: string;
  dbConsoleUrl: string;
  cpanelUrl: string;
  orgAddress: string;
  orgPhone: string;
  primaryCurrency: string;
  supportEmail: string;
  pageTitle: string;
  calendarTimeZone: string;
  calendarSyncStart: string;
  calendarSyncLookaheadDays: string;
  calendarExcludeSummaries: string;
  calendarDailyMaxDays: string;
};

export const DEFAULT_SETTINGS: AppSettings = {
  orgName: "Bioalergia",
  tagline: "Gestión integral de finanzas",
  primaryColor: "#0e64b7",
  secondaryColor: "#f1a722",
  logoUrl: "",
  faviconUrl: "/logo_bimi.svg",
  dbDisplayHost: "localhost",
  dbDisplayName: "finanzas",
  dbConsoleUrl: "",
  cpanelUrl: "",
  orgAddress: "",
  orgPhone: "",
  primaryCurrency: "CLP",
  supportEmail: "soporte@bioalergia.cl",
  pageTitle: "Bioalergia · Finanzas",
  calendarTimeZone: "America/Santiago",
  calendarSyncStart: "2000-01-01",
  calendarSyncLookaheadDays: "365",
  calendarExcludeSummaries: "No Disponible",
  calendarDailyMaxDays: "31",
};

export type SettingsContextType = {
  settings: AppSettings;
  loading: boolean;
  updateSettings: (next: AppSettings) => Promise<void>;
  canEdit: (...roles: UserRole[]) => boolean;
};

export const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function useSettings(): SettingsContextType {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error("useSettings debe usarse dentro de un SettingsProvider.");
  }
  return ctx;
}
