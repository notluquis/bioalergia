// Deprecated: SettingsContext is replaced by direct Query logic
// Re-exporting for backward compatibility

import { createContext } from "react";
import type { AppSettings } from "@/features/settings/hooks/use-settings";

// Re-export types and hook
export type { AppSettings } from "@/features/settings/hooks/use-settings";
export {
  applyBranding,
  DEFAULT_SETTINGS,
  useSettings,
} from "@/features/settings/hooks/use-settings";

export interface SettingsContextType {
  canEdit: (...roles: string[]) => boolean;
  loading: boolean;
  settings: AppSettings;
  updateSettings: (next: AppSettings) => Promise<void>;
}

export const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

// Dummy Provider
export function SettingsProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
