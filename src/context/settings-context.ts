// Re-export the canonical SettingsContext and hooks from `SettingsContext.tsx` to keep
// backwards compatibility with older import paths (e.g. "./context/settings-context").
// This avoids accidental duplicate Context definitions while preserving imports.
export {
  SettingsProvider,
  useSettings,
  type AppSettings,
  type SettingsContextType,
  DEFAULT_SETTINGS,
} from "./SettingsContext";

// Note: Prefer importing from './context/SettingsContext' directly. This file exists
// only as a compatibility shim to avoid runtime errors caused by importing a
// different context instance on case-insensitive file systems.
