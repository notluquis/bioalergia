import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth, type UserRole } from "./AuthContext";
import { logger } from "../lib/logger";

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
  primaryColor: "oklch(var(--p))",
  secondaryColor: "oklch(var(--s))",
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

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { user, hasRole } = useAuth();
  const queryClient = useQueryClient();

  const settingsQuery = useQuery<AppSettings, Error>({
    queryKey: ["settings"],
    enabled: Boolean(user),
    queryFn: async () => {
      logger.info("[settings] fetch:start", { userId: user?.id ?? null });
      const res = await fetch("/api/settings", { credentials: "include" });
      if (!res.ok) {
        throw new Error("No se pudo obtener la configuración");
      }
      const payload = (await res.json()) as { status: string; settings?: AppSettings };
      if (payload.status !== "ok" || !payload.settings) {
        throw new Error("Respuesta inválida de la API de configuración");
      }
      logger.info("[settings] fetch:success", payload.settings);
      return payload.settings;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  useEffect(() => {
    if (!user) {
      applyBranding(DEFAULT_SETTINGS);
      queryClient.removeQueries({ queryKey: ["settings"] });
    }
  }, [user, queryClient]);

  useEffect(() => {
    if (settingsQuery.isError && settingsQuery.error) {
      logger.error("[settings] fetch:error", settingsQuery.error);
    }
  }, [settingsQuery.isError, settingsQuery.error]);

  const updateSettings = useCallback(
    async (next: AppSettings) => {
      logger.info("[settings] update:start", next);
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(next),
      });
      const payload = (await res.json()) as { status: string; settings?: AppSettings; message?: string };
      if (!res.ok || payload.status !== "ok" || !payload.settings) {
        logger.warn("[settings] update:error", { status: res.status, message: payload.message });
        throw new Error(payload.message || "No se pudo actualizar la configuración");
      }
      applyBranding(payload.settings);
      logger.info("[settings] update:success", payload.settings);
      queryClient.setQueryData<AppSettings>(["settings"], payload.settings);
    },
    [queryClient]
  );

  const currentSettings = user ? (settingsQuery.data ?? DEFAULT_SETTINGS) : DEFAULT_SETTINGS;

  // Extract only the color properties to avoid re-applying branding on unrelated changes
  const primaryColor = currentSettings.primaryColor;
  const secondaryColor = currentSettings.secondaryColor;

  // Apply branding only when colors actually change (not on every render)
  const previousColorsRef = useRef({ primaryColor: "", secondaryColor: "" });

  useEffect(() => {
    // Only apply branding if colors have changed
    const prev = previousColorsRef.current;
    if (prev.primaryColor !== primaryColor || prev.secondaryColor !== secondaryColor) {
      applyBranding({
        ...DEFAULT_SETTINGS,
        primaryColor,
        secondaryColor,
      });
      previousColorsRef.current = { primaryColor, secondaryColor };
    }
  }, [primaryColor, secondaryColor]);

  const loading = Boolean(user) && settingsQuery.isFetching;

  const value = useMemo<SettingsContextType>(
    () => ({ settings: currentSettings, loading, updateSettings, canEdit: hasRole }),
    [currentSettings, loading, hasRole, updateSettings]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error("useSettings debe usarse dentro de un SettingsProvider.");
  }
  return ctx;
}

function applyBranding(next: AppSettings) {
  const root = document.documentElement;
  root.style.setProperty("--brand-primary", next.primaryColor);
  root.style.setProperty("--brand-primary-rgb", colorToRgb(next.primaryColor));
  root.style.setProperty("--brand-secondary", next.secondaryColor);
  root.style.setProperty("--brand-secondary-rgb", colorToRgb(next.secondaryColor));
}

function colorToRgb(color: string) {
  // If it's a CSS variable or CSS function, return as-is for CSS to handle
  // eslint-disable-next-line no-restricted-syntax
  if (color.includes("var(") || color.includes("oklch(") || color.includes("hsl(") || color.includes("rgb(")) {
    return color;
  }
  // Otherwise, convert hex to rgb
  const hex = color.replace("#", "");
  const bigint = parseInt(hex.length === 3 ? hex.repeat(2) : hex, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `${r} ${g} ${b}`;
}
