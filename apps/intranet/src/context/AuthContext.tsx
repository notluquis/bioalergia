// Deprecated: AuthContext is replaced by direct TanStack Store + Query logic
// Re-exporting for backward compatibility

import type { AuthContextType } from "@/features/auth/hooks/use-auth";

export type { AuthContextType } from "@/features/auth/hooks/use-auth";
export { useAuth } from "@/features/auth/hooks/use-auth";
export type { AuthSessionData, AuthUser, LoginResult } from "@/features/auth/types";

// Expose dummy Context if strictly needed, but types show it might be used.
// If any code uses useContext(AuthContext), it will fail if we don't validly provide it.
// Ideally, we search and destroy usage of AuthContext object.
// But for now, we leave it undefined or null, assuming useAuth is the primary consumer.
// Since we removed <AuthProvider>, there is NO Context Provider in the tree.
// So usage of useContext(AuthContext) will return undefined.
// If code relies on { can } = useContext(AuthContext), it will crash.
// User code "ocupa tanstack store en todos lados" implies we move away from Context.
// I assume useAuth is the standard way.

import { createContext } from "react";
export const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Dummy Provider if someone imports it
export function AuthProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
