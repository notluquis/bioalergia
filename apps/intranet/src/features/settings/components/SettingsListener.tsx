import { useEffect, useRef } from "react";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { applyBranding, DEFAULT_SETTINGS, useSettings } from "../hooks/use-settings";

/**
 * Component responsible for synchronizing Settings (Branding) with DOM.
 * Should be mounted once at the root of the application.
 */
export function SettingsListener() {
  const { user } = useAuth();
  const { settings } = useSettings();

  const previousColorsRef = useRef({ primaryColor: "", secondaryColor: "" });

  // Cleanup on logout
  useEffect(() => {
    if (!user) {
      applyBranding(DEFAULT_SETTINGS);
      // Remove queries? Handled by hook usage enabled flag, but maybe clear cache?
      // Auth logout handles cache validation usually.
      // queryClient.removeQueries({ queryKey: ["settings"] }); // Doing this here might duplicate logout logic
    }
  }, [user]);

  // Apply branding
  useEffect(() => {
    const { primaryColor, secondaryColor } = settings;
    const prev = previousColorsRef.current;

    if (prev.primaryColor !== primaryColor || prev.secondaryColor !== secondaryColor) {
      applyBranding(settings);
      previousColorsRef.current = { primaryColor, secondaryColor };
    }
  }, [settings]);

  return null;
}
