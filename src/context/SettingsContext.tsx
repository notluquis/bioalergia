import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth, type UserRole } from "./AuthContext";
import { logger } from "../lib/logger";

export type AppSettings = {
  orgName: string;
  tagline: string;
  primaryColor: string;
  secondaryColor: string;
  logoUrl: string;
  dbDisplayHost: string;
  dbDisplayName: string;
  dbConsoleUrl: string;
  cpanelUrl: string;
  orgAddress: string;
  orgPhone: string;
  primaryCurrency: string;
  supportEmail: string;
};

export const DEFAULT_SETTINGS: AppSettings = {
  orgName: "Bioalergia",
  tagline: "Gestión integral de finanzas",
  primaryColor: "#0e64b7",
  secondaryColor: "#f1a722",
  logoUrl:
    "https://bioalergia.cl/wp-content/uploads/2025/04/Logo-Bioalergia-con-eslogan-y-marca-registrada-1-scaled.png",
  dbDisplayHost: "localhost",
  dbDisplayName: "finanzas",
  dbConsoleUrl: "",
  cpanelUrl: "",
  orgAddress: "",
  orgPhone: "",
  primaryCurrency: "CLP",
  supportEmail: "soporte@bioalergia.cl",
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

  const updateSettings = useCallback(async (next: AppSettings) => {
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
  }, [queryClient]);

  useEffect(() => {
    // Aplica branding inicial
    applyBranding(DEFAULT_SETTINGS);
  }, []);

  const currentSettings = user ? settingsQuery.data ?? DEFAULT_SETTINGS : DEFAULT_SETTINGS;

  useEffect(() => {
    applyBranding(currentSettings);
  }, [currentSettings]);

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
  root.style.setProperty("--brand-primary-rgb", hexToRgb(next.primaryColor));
  root.style.setProperty("--brand-secondary", next.secondaryColor);
  root.style.setProperty("--brand-secondary-rgb", hexToRgb(next.secondaryColor));
}

function hexToRgb(color: string) {
  const hex = color.replace("#", "");
  const bigint = parseInt(hex.length === 3 ? hex.repeat(2) : hex, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `${r} ${g} ${b}`;
}
