import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { logger } from "../lib/logger";

export type UserRole = "GOD" | "ADMIN" | "ANALYST" | "VIEWER";

export type AuthUser = {
  id: number;
  email: string;
  role: UserRole;
  name: string | null;
};

export type AuthContextType = {
  user: AuthUser | null;
  initializing: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (...roles: UserRole[]) => boolean;
};

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const timeoutSeconds = Number(import.meta.env?.VITE_AUTH_TIMEOUT ?? 8);

  const sessionQuery = useQuery({
    queryKey: ["auth", "session"],
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
        const res = await fetch("/api/auth/me", {
          credentials: "include",
          signal: controller?.signal,
        });

        if (res.status === 401) {
          logger.warn("[auth] bootstrap: sin sesión", { status: res.status });
          return null;
        }

        if (!res.ok) {
          const message = `${res.status} ${res.statusText}`;
          logger.warn("[auth] bootstrap: error de respuesta", { message });
          throw new Error(message);
        }

        const payload = (await res.json()) as { status: string; user?: AuthUser };
        if (payload.status === "ok" && payload.user) {
          logger.info("[auth] bootstrap: sesión válida", payload.user);
          return payload.user;
        }

        return null;
      } catch (error) {
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
  });

  const user = sessionQuery.data ?? null;
  const initializing = sessionQuery.isPending;

  const login = useCallback(async (email: string, password: string) => {
    logger.info("[auth] login:start", { email });
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });

    const payload = (await res.json()) as { status: string; user?: AuthUser; message?: string };
    if (!res.ok || payload.status !== "ok" || !payload.user) {
      logger.warn("[auth] login:error", { email, status: res.status, message: payload.message });
      throw new Error(payload.message || "No se pudo iniciar sesión");
    }

    queryClient.setQueryData(["auth", "session"], payload.user);
    logger.info("[auth] login:success", payload.user);
  }, [queryClient]);

  const logout = useCallback(async () => {
    logger.info("[auth] logout:start");
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });
    queryClient.setQueryData(["auth", "session"], null);
    await queryClient.invalidateQueries({ queryKey: ["settings"] });
    logger.info("[auth] logout:done");
  }, [queryClient]);

  const hasRole = useCallback((...roles: UserRole[]) => {
    if (!user) return false;
    if (user.role === "GOD") return true;
    if (!roles.length) return true;
    return roles.includes(user.role);
  }, [user]);

  const value = useMemo<AuthContextType>(
    () => ({ user, initializing, login, logout, hasRole }),
    [user, initializing, login, logout, hasRole]
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
