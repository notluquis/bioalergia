import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { logger } from "@/lib/logger";
import { apiClient, ApiError } from "@/lib/apiClient";

export type UserRole = "GOD" | "ADMIN" | "ANALYST" | "VIEWER";

export type AuthUser = {
  id: number;
  email: string;
  role: UserRole;
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
  login: (email: string, password: string) => Promise<LoginResult>;
  loginWithMfa: (userId: number, token: string) => Promise<void>;
  loginWithPasskey: (authResponse: unknown, challenge: string) => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (...roles: UserRole[]) => boolean;
  refreshSession: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const timeoutSeconds = Number(import.meta.env?.VITE_AUTH_TIMEOUT ?? 8);

  const sessionQuery = useQuery({
    queryKey: ["auth", "session", timeoutSeconds],
    queryFn: async (): Promise<AuthUser | null> => {
      const controller = typeof AbortController !== "undefined" ? new AbortController() : undefined;
      const timeoutId =
        typeof window !== "undefined" && controller
          ? window.setTimeout(() => {
              if (!controller.signal.aborted) {
                logger.warn("[auth] bootstrap: cancelado por timeout", { timeoutSeconds });
                controller.abort();
              }
            }, timeoutSeconds * 1000)
          : null;

      try {
        const payload = await apiClient.get<{ status: string; user?: AuthUser }>("/api/auth/me", {
          signal: controller?.signal,
        });

        if (payload.status === "ok" && payload.user) {
          return payload.user;
        }

        return null;
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          return null;
        }
        if ((error as DOMException)?.name === "AbortError") {
          logger.warn("[auth] bootstrap: abortado por timeout");
          return null;
        }
        logger.error("[auth] bootstrap: error", error);
        return null;
      } finally {
        if (typeof window !== "undefined" && timeoutId != null) {
          window.clearTimeout(timeoutId);
        }
      }
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: false,
  });

  const user = sessionQuery.data ?? null;
  const initializing = sessionQuery.isPending;

  const login = useCallback(
    async (email: string, password: string): Promise<LoginResult> => {
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
        queryClient.setQueryData(["auth", "session"], payload.user);
        logger.info("[auth] login:success", payload.user);
        return { status: "ok", user: payload.user };
      }

      throw new Error("Respuesta inesperada del servidor");
    },
    [queryClient]
  );

  const loginWithMfa = useCallback(
    async (userId: number, token: string) => {
      logger.info("[auth] mfa:start", { userId });
      const payload = await apiClient.post<{ status: string; user?: AuthUser; message?: string }>(
        "/api/auth/login/mfa",
        { userId, token }
      );

      if (payload.status !== "ok" || !payload.user) {
        throw new Error(payload.message || "Código MFA inválido");
      }

      queryClient.setQueryData(["auth", "session"], payload.user);
      logger.info("[auth] mfa:success", payload.user);
    },
    [queryClient]
  );

  const loginWithPasskey = useCallback(
    async (authResponse: unknown, challenge: string) => {
      logger.info("[auth] passkey:start");
      const payload = await apiClient.post<{ status: string; user?: AuthUser; message?: string }>(
        "/api/auth/passkey/login/verify",
        { body: authResponse, challenge }
      );

      if (payload.status !== "ok" || !payload.user) {
        throw new Error(payload.message || "Error validando Passkey");
      }

      queryClient.setQueryData(["auth", "session"], payload.user);
      logger.info("[auth] passkey:success", payload.user);
    },
    [queryClient]
  );

  const logout = useCallback(async () => {
    logger.info("[auth] logout:start");
    await apiClient.post("/api/auth/logout", {});
    queryClient.setQueryData(["auth", "session"], null);
    await queryClient.invalidateQueries({ queryKey: ["settings"] });
    logger.info("[auth] logout:done");
  }, [queryClient]);

  const hasRole = useCallback(
    (...roles: UserRole[]) => {
      if (!user) return false;
      if (user.role === "GOD") return true;
      if (!roles.length) return true;
      return roles.includes(user.role);
    },
    [user]
  );

  const refreshSession = useCallback(async () => {
    await sessionQuery.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch is stable by design
  }, [sessionQuery.refetch]);

  const value = useMemo<AuthContextType>(
    () => ({ user, initializing, login, loginWithMfa, loginWithPasskey, logout, hasRole, refreshSession }),
    [user, initializing, login, loginWithMfa, loginWithPasskey, logout, hasRole, refreshSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth debe usarse dentro de un AuthProvider.");
  }
  return ctx;
}
