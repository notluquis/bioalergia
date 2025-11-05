// Re-export the canonical AuthContext and hooks from `AuthContext.tsx` to keep
// backwards compatibility with older import paths (e.g. "./context/auth-context").
// This avoids accidental duplicate Context definitions while preserving imports.
export { AuthProvider, useAuth, type AuthUser, type UserRole } from "./AuthContext";

// Note: Prefer importing from './context/AuthContext' directly. This file exists
// only as a compatibility shim to avoid runtime errors caused by importing a
// different context instance on case-insensitive file systems.
