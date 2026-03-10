import { createORPCClient, ORPCError } from "@orpc/client";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { ApiError } from "@/lib/api-client";
import type { AuthUser } from "./types";

type AuthORPCClient = {
  login: (input: { email: string; password: string }) => Promise<
    | {
        status: "mfa_required";
        userId: number;
      }
    | {
        abilityRules: unknown[];
        status: "ok";
        user: AuthUser;
      }
  >;
  loginMfa: (input: { token: string; userId: number }) => Promise<{
    abilityRules: unknown[];
    status: "ok";
    user: AuthUser;
  }>;
  logout: (input: Record<string, never>) => Promise<{ status: "ok" }>;
  mfaDisable: (input: Record<string, never>) => Promise<{ status: "ok" }>;
  mfaEnable: (input: { token: string }) => Promise<{ status: "ok" }>;
  mfaSetup: (input: Record<string, never>) => Promise<{
    qrCodeUrl: string;
    secret: string;
    status: "ok";
  }>;
  passkeyLoginOptions: () => Promise<Record<string, unknown>>;
  passkeyLoginVerify: (input: { body: Record<string, unknown>; challenge: string }) => Promise<{
    abilityRules: unknown[];
    status: "ok";
    user: AuthUser;
  }>;
  passkeyRegisterOptions: () => Promise<Record<string, unknown>>;
  passkeyRegisterVerify: (input: { body: Record<string, unknown>; challenge: string }) => Promise<{
    message?: string;
    status: "ok";
  }>;
  passkeyRemove: (input: Record<string, never>) => Promise<{
    message?: string;
    status: "ok";
  }>;
  session: () => Promise<{
    abilityRules?: unknown[] | null;
    permissionVersion?: number | null;
    status: "ok";
    user?: AuthUser | null;
  }>;
};

const authORPCLink = new SuperJSONLink({
  fetch: (request, init) => fetch(request, { ...init, credentials: "include" }),
  url: () => window.location.origin,
});

export const authORPCClient = createORPCClient<AuthORPCClient>(authORPCLink, {
  path: ["api", "orpc", "auth", "rpc"],
});

export function toAuthApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }

  if (error instanceof ORPCError) {
    return new ApiError(error.message, error.status, error.data);
  }

  if (error instanceof Error) {
    return new ApiError(error.message, 500);
  }

  return new ApiError("Error inesperado", 500, error);
}
