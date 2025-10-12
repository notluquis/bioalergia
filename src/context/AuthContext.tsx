import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { logger } from "../lib/logger";
import {
  AuthContext,
  type AuthContextType,
  type AuthUser,
  type UserRole,
} from "./auth-context";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (typeof window === "undefined" || !("AbortController" in window)) {
      logger.warn("[auth] bootstrap: AbortController no disponible en este entorno");
      fetch("/api/auth/me", { credentials: "include" })
        .then(async (res) => {
          if (!res.ok) {
            logger.warn("[auth] bootstrap: sin sesión", { status: res.status });
            setUser(null);
            return;
          }
          const payload = (await res.json()) as { status: string; user: AuthUser };
          if (payload.status === "ok") {
            setUser(payload.user);
            logger.info("[auth] bootstrap: sesión válida", payload.user);
          }
        })
        .catch((error) => {
          logger.error("[auth] bootstrap: error", error);
          setUser(null);
        })
        .finally(() => setInitializing(false));
      return;
    }

    const controller = new AbortController();
    const timeoutSeconds = Number(import.meta.env?.VITE_AUTH_TIMEOUT ?? 8);
    const timeoutId = window.setTimeout(() => {
      if (!controller.signal.aborted) {
        logger.warn("[auth] bootstrap: cancelado por timeout", { timeoutSeconds });
        controller.abort();
      }
    }, timeoutSeconds * 1000);

    async function bootstrap() {
      try {
        console.debug("[steps][auth] Step 1: iniciando bootstrap de sesión activa");
        logger.info("[auth] bootstrap: solicitando sesión activa");
        logger.info("[steps][auth] configurado timeout", { timeoutSeconds });
        const res = await fetch("/api/auth/me", {
          credentials: "include",
          signal: controller.signal,
        });
        console.debug("[steps][auth] Step 2: respuesta /api/auth/me", res.status);
        if (!res.ok) {
          logger.warn("[auth] bootstrap: sin sesión", { status: res.status });
          console.warn("[steps][auth] Step 3: sesión no válida", res.status);
          if (!cancelled) {
            setUser(null);
          }
          return;
        }
        const payload = (await res.json()) as { status: string; user: AuthUser };
        console.debug("[steps][auth] Step 4: payload recibido", payload.status);
        if (!cancelled && payload?.status === "ok") {
          setUser(payload.user);
          logger.info("[auth] bootstrap: sesión válida", payload.user);
          console.debug("[steps][auth] Step 5: usuario establecido", payload.user?.email);
        }
      } catch (error) {
        if ((error as DOMException)?.name === "AbortError") {
          console.warn("[steps][auth] Step error: solicitud abortada", error);
          return;
        }
        logger.error("[auth] bootstrap: error", error);
        console.error("[steps][auth] Step error: se produjo una excepción", error);
        if (!cancelled) setUser(null);
      } finally {
        window.clearTimeout(timeoutId);
        console.debug("[steps][auth] Step final: inicialización completada");
        if (!cancelled) setInitializing(false);
      }
    }
    bootstrap();
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, []);

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

    setUser(payload.user);
    logger.info("[auth] login:success", payload.user);
  }, []);

  const logout = useCallback(async () => {
    logger.info("[auth] logout:start");
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });
    setUser(null);
    logger.info("[auth] logout:done");
  }, []);

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
