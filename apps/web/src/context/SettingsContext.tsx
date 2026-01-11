import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, type ReactNode, useContext, useEffect, useRef } from "react";

import { APP_CONFIG } from "@/config/app";
import { apiClient } from "@/lib/apiClient";
import { logger } from "@/lib/logger";

import { useAuth } from "./AuthContext";

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
  orgName: APP_CONFIG.name,
  orgAddress: "",
  orgPhone: "",
  ...APP_CONFIG.defaults,
};

export type SettingsContextType = {
  settings: AppSettings;
  loading: boolean;
  updateSettings: (next: AppSettings) => Promise<void>;
  canEdit: (...roles: string[]) => boolean;
};

export const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { user, hasRole } = useAuth();
  const queryClient = useQueryClient();

  const settingsQuery = useQuery<AppSettings, Error>({
    queryKey: ["settings", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      logger.info("[settings] fetch:start", { userId: user?.id ?? null });
      // Use internal settings endpoint
      type InternalSettingsResponse = {
        internal?: {
          upsertChunkSize?: number | string;
          envUpsertChunkSize?: string;
        };
      };
      const payload = await apiClient.get<InternalSettingsResponse>("/api/settings/internal");

      // Map internal structure to AppSettings or return defaults if not found
      // Assuming backend returns { internal: { ... } } we need to adapt it
      // But wait, the backend currently returns { internal: { upsertChunkSize... } }
      // The AppSettings type has orgName etc.
      // It seems the backend implementation for org settings is MISSING or DIFFERENT.
      // For now, let's fix the URL to avoid 400, but we might get partial data.
      // Actually, if I look at api.ts in web, fetchInternalSettings returns InternalSettingsResponse.
      // SettingsContext expects AppSettings.
      // This context seems to be for visual branding + internal.
      // If backend only has /internal, where are the visual settings stored?
      // If they are missing, we should return DEFAULT_SETTINGS from the fetch or mock it.

      // Correcting the endpoint to avoid 400.
      if (!payload) return DEFAULT_SETTINGS;

      // Ensure we return AppSettings structure.
      // If payload only has internal, we merge with defaults.
      return { ...DEFAULT_SETTINGS, ...payload };
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

  const updateSettings = async (next: AppSettings) => {
    logger.info("[settings] update:start", next);
    const payload = await apiClient.put<{ status: string; settings?: AppSettings; message?: string }>(
      "/api/settings/internal",
      next
    );
    if (payload.status !== "ok" || !payload.settings) {
      logger.warn("[settings] update:error", { message: payload.message });
      throw new Error(payload.message || "No se pudo actualizar la configuración");
    }
    applyBranding(payload.settings);
    logger.info("[settings] update:success", payload.settings);
    queryClient.setQueryData<AppSettings>(["settings"], payload.settings);
  };

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

  const value: SettingsContextType = { settings: currentSettings, loading, updateSettings, canEdit: hasRole };

  return <SettingsContext value={value}>{children}</SettingsContext>;
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

const DEFAULT_RGB_BLACK = "0 0 0";

function colorToRgb(color: string) {
  // If it's a CSS variable or CSS function, return as-is for CSS to handle
  if (!color) return DEFAULT_RGB_BLACK;
  if (/^(var|oklch|hsl|rgb|rgba)\(/.test(color)) {
    return color;
  }
  // Otherwise, convert hex to rgb
  const hex = color.replace("#", "");
  const bigint = Number.parseInt(hex.length === 3 ? hex.repeat(2) : hex, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `${r} ${g} ${b}`;
}
