import { MongoAbility, RawRuleOf } from "@casl/ability";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from "react";

import { apiClient, ApiError } from "@/lib/apiClient";
import { ability, updateAbility } from "@/lib/authz/ability";
import { logger } from "@/lib/logger";
import type { Role } from "@/types/roles";

export type AuthUser = {
  id: number;
  email: string;
  roles: string[];
  name: string | null;
  mfaEnabled?: boolean;
  status: string;
  hasPasskey?: boolean;
  mfaEnforced?: boolean;
};

export type LoginResult = { status: "ok"; user: AuthUser } | { status: "mfa_required"; userId: number };

export type AuthContextType = {
  user: AuthUser | null;
  initializing: boolean;
  ensureSession: () => Promise<AuthUser | null>;
  login: (email: string, password: string) => Promise<LoginResult>;
  loginWithMfa: (userId: number, token: string) => Promise<void>;
  loginWithPasskey: (authResponse: unknown, challenge: string) => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (...roles: string[]) => boolean;
  can: (action: string, subject: string, field?: string) => boolean;
  refreshSession: () => Promise<void>;
  impersonate: (role: Role) => void;
  stopImpersonating: () => void;
  impersonatedRole: Role | null;
};

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ... (existing imports)

export type AuthSessionData = {
  user: AuthUser | null;
  abilityRules: RawRuleOf<MongoAbility>[] | null;
  permissionVersion: number | null;
};

// ... (existing AuthContextType definition)

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const sessionQuery = useQuery({
    queryKey: ["auth", "session"],
    queryFn: async (): Promise<AuthSessionData | null> => {
      try {
        const payload = await apiClient.get<{
          status: string;
          user?: AuthUser;
          abilityRules?: RawRuleOf<MongoAbility>[];
          permissionVersion?: number;
        }>("/api/auth/me/session");

        if (payload.status === "ok" && payload.user) {
          updateAbility(payload.abilityRules || []);
          return {
            user: payload.user,
            abilityRules: payload.abilityRules || [],
            permissionVersion: payload.permissionVersion || 0,
          };
        }

        updateAbility([]);
        return null;
      } catch (error) {
        // 401 = not authenticated (expected, not an error)
        if (error instanceof ApiError && error.status === 401) {
          updateAbility([]);
          return null;
        }
        // Re-throw for retry mechanism
        throw error;
      }
    },
    staleTime: 5 * 60 * 1000, // 5 min before refetch
    gcTime: 10 * 60 * 1000, // 10 min cache
    retry: 2, // Retry twice on network errors
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000), // Exponential backoff: 1s, 2s, 4s (max 8s)
  });

  const [impersonatedRole, setImpersonatedRole] = useState<Role | null>(null);

  const realUser = sessionQuery.data?.user ?? null;
  const initializing = sessionQuery.isPending;

  const effectiveUser = (() => {
    if (!realUser) return null;
    if (impersonatedRole) {
      return { ...realUser, roles: [impersonatedRole.name] };
    }
    return realUser;
  })();

  // Sync ability when session loads or when impersonation changes
  useEffect(() => {
    if (impersonatedRole) {
      // Build rules from the role
      const rules = impersonatedRole.permissions.map((rp) => ({
        action: rp.permission.action,
        subject: rp.permission.subject,
      }));
      updateAbility(rules);
    } else if (sessionQuery.data) {
      updateAbility(sessionQuery.data.abilityRules || []);
    } else {
      updateAbility([]);
    }
  }, [impersonatedRole, sessionQuery.data]);

  const impersonate = (role: Role) => {
    setImpersonatedRole(role);
  };

  const stopImpersonating = () => {
    setImpersonatedRole(null);
  };

  const login = async (email: string, password: string): Promise<LoginResult> => {
    logger.info("[auth] login:start", { email });
    const payload = await apiClient.post<{ status: string; user?: AuthUser; userId: number; message?: string }>(
      "/api/auth/login",
      { email, password }
    );

    if (payload.status === "mfa_required") {
      logger.info("[auth] login:mfa_required", { userId: payload.userId });
      return { status: "mfa_required", userId: payload.userId };
    }

    if (payload.status === "ok" && payload.user) {
      queryClient.invalidateQueries({ queryKey: ["auth", "session"] });
      logger.info("[auth] login:success", payload.user);
      return { status: "ok", user: payload.user };
    }

    throw new Error("Respuesta inesperada del servidor");
  };

  const loginWithMfa = async (userId: number, token: string) => {
    logger.info("[auth] mfa:start", { userId });
    const payload = await apiClient.post<{ status: string; user?: AuthUser; message?: string }>("/api/auth/login/mfa", {
      userId,
      token,
    });

    if (payload.status !== "ok" || !payload.user) {
      throw new Error(payload.message || "Código MFA inválido");
    }

    queryClient.invalidateQueries({ queryKey: ["auth", "session"] });
    logger.info("[auth] mfa:success", payload.user);
  };

  const loginWithPasskey = async (authResponse: unknown, challenge: string) => {
    logger.info("[auth] passkey:start");
    const payload = await apiClient.post<{ status: string; user?: AuthUser; message?: string }>(
      "/api/auth/passkey/login/verify",
      { body: authResponse, challenge }
    );

    if (payload.status !== "ok" || !payload.user) {
      throw new Error(payload.message || "Error validando Passkey");
    }

    queryClient.invalidateQueries({ queryKey: ["auth", "session"] });
    logger.info("[auth] passkey:success", payload.user);
  };

  const logout = async () => {
    logger.info("[auth] logout:start");
    try {
      setImpersonatedRole(null);
      await apiClient.post("/api/auth/logout", {});
    } catch (error) {
      logger.error("[auth] logout:error", error);
    } finally {
      queryClient.setQueryData(["auth", "session"], null);
      updateAbility([]);
      await queryClient.invalidateQueries({ queryKey: ["settings"] });
      logger.info("[auth] logout:done");
    }
  };

  const hasRole = (...rolesToCheck: string[]) => {
    if (!effectiveUser) return false;
    if (rolesToCheck.length === 0) return true;

    const userRoles = new Set(effectiveUser.roles.map((r) => r.toUpperCase()));
    return rolesToCheck.some((r) => userRoles.has(r.toUpperCase()));
  };

  const { refetch: refetchSession } = sessionQuery;

  const refreshSession = async () => {
    await refetchSession();
  };

  // Promise that resolves when session is loaded (for router beforeLoad)
  const ensureSession = useCallback(async (): Promise<AuthUser | null> => {
    // If already loaded, return immediately
    if (!sessionQuery.isPending && !sessionQuery.isFetching) {
      return sessionQuery.data?.user ?? null;
    }
    // Wait for the query to complete
    const result = await refetchSession();
    return result.data?.user ?? null;
  }, [sessionQuery.isPending, sessionQuery.isFetching, sessionQuery.data, refetchSession]);

  const can = useCallback((action: string, subject: string, field?: string) => {
    // Wrapper for CASL ability
    return ability.can(action, subject, field);
  }, []); // ability is imported from lib/authz/ability, stable instance

  const value: AuthContextType = {
    user: effectiveUser,
    initializing,
    ensureSession,
    login,
    loginWithMfa,
    loginWithPasskey,
    logout,
    hasRole,
    refreshSession,
    can,
    impersonate,
    stopImpersonating,
    impersonatedRole,
  };

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth debe usarse dentro de un AuthProvider.");
  }
  return ctx;
}
