import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { APP_CONFIG } from "@/config/app";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { apiClient } from "@/lib/api-client";
import { logger } from "@/lib/logger";

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
  tagline: string;
}

// eslint-disable-next-line react-refresh/only-export-components
export const DEFAULT_SETTINGS: AppSettings = {
  orgAddress: "",
  orgName: APP_CONFIG.name,
  orgPhone: "",
  ...APP_CONFIG.defaults,
};

const InternalSettingsResponseSchema = z.looseObject({
  internal: z
    .object({
      envUpsertChunkSize: z.string().optional(),
      upsertChunkSize: z.union([z.number(), z.string()]).optional(),
    })
    .optional(),
});

const UpdateSettingsResponseSchema = z.looseObject({
  message: z.string().optional(),
  settings: z.unknown().optional(),
  status: z.string(),
});

export function useSettings() {
  const { user, hasRole } = useAuth();
  const queryClient = useQueryClient();

  const settingsQuery = useQuery<AppSettings>({
    enabled: Boolean(user),
    gcTime: 10 * 60 * 1000,
    queryFn: async () => {
      logger.info("[settings] fetch:start", { userId: user?.id ?? null });
      interface InternalSettingsResponse {
        internal?: {
          envUpsertChunkSize?: string;
          upsertChunkSize?: number | string;
        };
      }
      const payload = await apiClient.get<InternalSettingsResponse>("/api/settings/internal", {
        responseSchema: InternalSettingsResponseSchema,
      });
      return { ...DEFAULT_SETTINGS, ...payload };
    },
    queryKey: ["settings", user?.id],
    staleTime: 5 * 60 * 1000,
  });

  const updateSettings = async (next: AppSettings) => {
    logger.info("[settings] update:start", next);
    const payload = await apiClient.put<{
      message?: string;
      settings?: AppSettings;
      status: string;
    }>("/api/settings/internal", next, { responseSchema: UpdateSettingsResponseSchema });

    if (payload.status !== "ok" || !payload.settings) {
      logger.warn("[settings] update:error", { message: payload.message });
      throw new Error(payload.message ?? "No se pudo actualizar la configuración");
    }

    logger.info("[settings] update:success", payload.settings);
    queryClient.setQueryData<AppSettings>(["settings"], payload.settings);
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
