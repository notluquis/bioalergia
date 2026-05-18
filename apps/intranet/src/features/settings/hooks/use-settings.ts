import { useQuery, useQueryClient } from "@tanstack/react-query";
import { APP_CONFIG } from "@/config/app";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { ApiError } from "@/lib/api-client";
import { logger } from "@/lib/logger";
import { fetchAppSettings, updateAppSettings } from "../api";

export interface AppSettings {
  calendarDailyMaxDays: string;
  calendarExcludeSummaries: string;
  calendarSyncLookaheadDays: string;
  calendarSyncStart: string;
  calendarTimeZone: string;
  cpanelUrl: string;
  dbConsoleUrl: string;
  dbDisplayHost: string;
  dbDisplayName: string;
  faviconUrl: string;
  logoUrl: string;
  orgAddress: string;
  orgName: string;
  orgPhone: string;
  pageTitle: string;
  primaryColor: string;
  primaryCurrency: string;
  secondaryColor: string;
  supportEmail: string;
  whatsappFreeformMessage: string;
  tagline: string;
  shopLowStockThreshold: string;
}

// eslint-disable-next-line react-refresh/only-export-components
export const DEFAULT_SETTINGS: AppSettings = {
  orgAddress: "",
  orgName: APP_CONFIG.name,
  orgPhone: "",
  whatsappFreeformMessage: "",
  ...APP_CONFIG.defaults,
};

export function useSettings() {
  const { user, hasRole } = useAuth();
  const queryClient = useQueryClient();
  const canFetchInternalSettings = Boolean(user && user.status !== "PENDING_SETUP");

  const settingsQuery = useQuery<AppSettings>({
    enabled: canFetchInternalSettings,
    gcTime: 10 * 60 * 1000,
    queryFn: async () => {
      logger.info("[settings] fetch:start", { userId: user?.id ?? null });
      try {
        const payload = await fetchAppSettings();
        return { ...DEFAULT_SETTINGS, ...payload };
      } catch (error) {
        // During onboarding or stale sessions, internal settings might be unavailable.
        // Do not break app rendering for branding defaults.
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          logger.info("[settings] fetch:skip_unauthorized", {
            status: error.status,
            userId: user?.id ?? null,
          });
          return DEFAULT_SETTINGS;
        }
        throw error;
      }
    },
    queryKey: ["settings", user?.id, user?.status],
    staleTime: 5 * 60 * 1000,
  });

  const updateSettings = async (next: AppSettings) => {
    logger.info("[settings] update:start", next);
    const payload = await updateAppSettings(next);

    if (payload.status !== "ok") {
      logger.warn("[settings] update:error", { message: payload.message });
      throw new Error(payload.message ?? "No se pudo actualizar la configuración");
    }

    logger.info("[settings] update:success", next);
    queryClient.setQueryData<AppSettings>(["settings", user?.id, user?.status], next);
  };

  const currentSettings = user ? (settingsQuery.data ?? DEFAULT_SETTINGS) : DEFAULT_SETTINGS;
  const loading = Boolean(user) && settingsQuery.isFetching;

  return {
    canEdit: hasRole,
    loading,
    settings: currentSettings,
    updateSettings,
  };
}

// Helper to apply branding (side effect)
export function applyBranding(next: AppSettings) {
  const root = document.documentElement;
  root.style.setProperty("--brand-primary", next.primaryColor);
  root.style.setProperty("--brand-primary-rgb", colorToRgb(next.primaryColor));
  root.style.setProperty("--brand-secondary", next.secondaryColor);
  root.style.setProperty("--brand-secondary-rgb", colorToRgb(next.secondaryColor));
}

const DEFAULT_RGB_BLACK = "0 0 0";
const COLOR_FUNC_REGEX = /^(var|oklch|hsl|rgb|rgba)\(/;

function colorToRgb(color: string) {
  if (!color) {
    return DEFAULT_RGB_BLACK;
  }
  if (COLOR_FUNC_REGEX.test(color)) {
    return color;
  }
  const hex = color.replace("#", "");
  const bigint = Number.parseInt(hex.length === 3 ? hex.repeat(2) : hex, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `${r} ${g} ${b}`;
}
