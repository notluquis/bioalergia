import type { MongoAbility, RawRuleOf } from "@casl/ability";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useStore } from "@tanstack/react-store";
import { useCallback } from "react";
import { ApiError, apiClient } from "@/lib/api-client";
import { ability, updateAbility } from "@/lib/authz/ability";
import { logger } from "@/lib/logger";
import type { Role } from "@/types/roles";
import {
  AuthSessionResponseSchema,
  LoginMfaResponseSchema,
  LoginResponseSchema,
  StatusResponseSchema,
} from "../schemas";
import { authStore, setImpersonatedRole } from "./../store/auth-store";
import type { AuthSessionData, AuthUser, LoginResult } from "../types";

type SessionPayload = {
  abilityRules?: RawRuleOf<MongoAbility>[];
  permissionVersion?: number;
  status: string;
  user?: AuthUser;
};

export function useAuth() {
  const queryClient = useQueryClient();
  const { impersonatedRole } = useStore(authStore, (state) => state);

  const sessionQuery = useQuery({
    gcTime: 10 * 60 * 1000, // 10 min cache
    queryFn: async (): Promise<AuthSessionData | null> => {
      try {
        const payload = await apiClient.get<SessionPayload>("/api/auth/me/session", {
          responseSchema: AuthSessionResponseSchema,
        });

        if (payload.status === "ok" && payload.user) {
          // Note: ability update is handled in AuthListener
          return {
            abilityRules: payload.abilityRules ?? [],
            permissionVersion: payload.permissionVersion ?? 0,
            user: payload.user,
          };
        }

        return null;
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          return null;
        }
        throw error;
      }
    },
    queryKey: ["auth", "session"],
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    staleTime: 5 * 60 * 1000,
  });

  const realUser = sessionQuery.data?.user ?? null;
  const initializing = sessionQuery.isPending;

  const effectiveUser = (() => {
    if (!realUser) {
      return null;
    }
    if (impersonatedRole) {
      return { ...realUser, roles: [impersonatedRole.name] };
    }
    return realUser;
  })();

  const login = async (email: string, password: string): Promise<LoginResult> => {
    logger.info("[auth] login:start", { email });
    const payload = await apiClient.post<{
      message?: string;
      status: string;
      user?: AuthUser;
      userId: number;
    }>("/api/auth/login", { email, password }, { responseSchema: LoginResponseSchema });

    if (payload.status === "mfa_required") {
      logger.info("[auth] login:mfa_required", { userId: payload.userId });
      return { status: "mfa_required", userId: payload.userId };
    }

    if (payload.status === "ok" && payload.user) {
      await queryClient.refetchQueries({ queryKey: ["auth", "session"] });
      logger.info("[auth] login:success", payload.user);
      return { status: "ok", user: payload.user };
    }

    throw new Error("Respuesta inesperada del servidor");
  };

  const loginWithMfa = async (userId: number, token: string) => {
    logger.info("[auth] mfa:start", { userId });
    const payload = await apiClient.post<{ message?: string; status: string; user?: AuthUser }>(
      "/api/auth/login/mfa",
      {
        token,
        userId,
      },
      { responseSchema: LoginMfaResponseSchema },
    );

    if (payload.status !== "ok" || !payload.user) {
      throw new Error(payload.message ?? "Código MFA inválido");
    }

    await queryClient.refetchQueries({ queryKey: ["auth", "session"] });
    logger.info("[auth] mfa:success", payload.user);
  };

  const loginWithPasskey = async (authResponse: unknown, challenge: string) => {
    logger.info("[auth] passkey:start");
    const payload = await apiClient.post<{ message?: string; status: string; user?: AuthUser }>(
      "/api/auth/passkey/login/verify",
      { body: authResponse, challenge },
      { responseSchema: LoginMfaResponseSchema },
    );

    if (payload.status !== "ok" || !payload.user) {
      throw new Error(payload.message ?? "Error validando Passkey");
    }

    await queryClient.refetchQueries({ queryKey: ["auth", "session"] });
    logger.info("[auth] passkey:success", payload.user);
  };

  const logout = async () => {
    logger.info("[auth] logout:start");
    try {
      setImpersonatedRole(null);
      await apiClient.post("/api/auth/logout", {}, { responseSchema: StatusResponseSchema });
    } catch (error) {
      logger.error("[auth] logout:error", error);
    } finally {
      queryClient.setQueryData(["auth", "session"], null);
      updateAbility([]);
      await queryClient.invalidateQueries({ queryKey: ["settings"] });
      logger.info("[auth] logout:done");
    }
  };

  const impersonate = (role: Role) => {
    setImpersonatedRole(role);
  };

  const stopImpersonating = () => {
    setImpersonatedRole(null);
  };

  const hasRole = useCallback(
    (...rolesToCheck: string[]) => {
      if (!effectiveUser) {
        return false;
      }
      if (rolesToCheck.length === 0) {
        return true;
      }

      const userRoles = new Set(effectiveUser.roles.map((r) => r.toUpperCase()));
      return rolesToCheck.some((r) => userRoles.has(r.toUpperCase()));
    },
    [effectiveUser],
  );

  const can = useCallback((action: string, subject: string, field?: string) => {
    return ability.can(action, subject, field);
  }, []);

  const refreshSession = async () => {
    await sessionQuery.refetch();
  };

  const ensureSession = useCallback(async (): Promise<AuthUser | null> => {
    if (!sessionQuery.isPending && !sessionQuery.isFetching) {
      return sessionQuery.data?.user ?? null;
    }
    const result = await sessionQuery.refetch();
    return result.data?.user ?? null;
  }, [sessionQuery]);

  return {
    can,
    ensureSession,
    checkRole: hasRole, // Alias for internal use if needed
    hasRole,
    impersonate,
    impersonatedRole,
    initializing,
    login,
    loginWithMfa,
    loginWithPasskey,
    logout,
    refreshSession,
    stopImpersonating,
    user: effectiveUser,
    sessionData: sessionQuery.data, // Internal use for Listener
  };
}

export type AuthContextType = {
  can: (action: string, subject: string, field?: string) => boolean;
  ensureSession: () => Promise<AuthUser | null>;
  checkRole: (...roles: string[]) => boolean;
  hasRole: (...roles: string[]) => boolean;
  impersonate: (role: Role) => void;
  impersonatedRole: Role | null;
  initializing: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  loginWithMfa: (userId: number, token: string) => Promise<void>;
  loginWithPasskey: (authResponse: unknown, challenge: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  stopImpersonating: () => void;
  user: AuthUser | null;
};
