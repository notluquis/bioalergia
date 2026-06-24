import { startAuthentication } from "@simplewebauthn/browser";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { fetchPasskeyLoginOptions } from "@/features/auth/api";
import { logger } from "@/lib/logger";

export type LoginStep = "credentials" | "mfa" | "passkey";

export interface LoginState {
  email: string;
  password: string;
  mfaCode: string;
  step: LoginStep;
  tempMfaToken: null | string;
  formError: null | string;
  isSuccess: boolean;
}

const INITIAL_STATE: LoginState = {
  email: "",
  password: "",
  mfaCode: "",
  step: "passkey",
  tempMfaToken: null,
  formError: null,
  isSuccess: false,
};

export function useLoginLogic(from: string) {
  const { login, loginWithMfa, loginWithPasskey } = useAuth();
  const navigate = useNavigate();
  const [state, setState] = useState<LoginState>(INITIAL_STATE);
  const { email, password, mfaCode, tempMfaToken } = state;
  const updateState = useCallback(
    (updates: Partial<LoginState>) => setState((p) => ({ ...p, ...updates })),
    []
  );
  const clearError = () => updateState({ formError: null });
  const redirectAfterSuccess = useCallback(() => {
    updateState({ isSuccess: true });
    setTimeout(() => {
      logger.info("[login-page] redirecting", { to: from });
      void navigate({ replace: true, to: from as "/" });
    }, 800);
  }, [from, navigate, updateState]);
  const credentialsMutation = useMutation({
    mutationFn: async () => {
      const r = await login(email, password);
      return r.status === "mfa_required"
        ? { requiresMfa: true, mfaToken: r.mfaToken }
        : { requiresMfa: false };
    },
    onSuccess: (d) => {
      if (d.requiresMfa) {
        updateState({ tempMfaToken: d.mfaToken, step: "mfa" });
        logger.info("[login-page] MFA required");
      } else {
        logger.info("[login-page] credentials login success", { user: email });
        redirectAfterSuccess();
      }
    },
    onError: (e) => {
      const msg = e instanceof Error ? e.message : "No se pudo iniciar sesión";
      updateState({ formError: msg });
      logger.error("[login-page] credentials login error", { email, message: msg });
    },
  });
  const mfaMutation = useMutation({
    mutationFn: async () => {
      if (!tempMfaToken) {
        throw new Error("No MFA token");
      }
      await loginWithMfa(tempMfaToken, mfaCode);
    },
    onSuccess: () => {
      logger.info("[login-page] MFA success");
      redirectAfterSuccess();
    },
    onError: (e) => {
      const msg = e instanceof Error ? e.message : "Código incorrecto";
      updateState({ formError: msg });
      logger.error("[login-page] MFA error", { message: msg });
    },
  });
  const passkeyMutation = useMutation({
    mutationFn: async () => {
      const result = await fetchPasskeyLoginOptions();

      if (result.type === "error") {
        // Type-safe discriminated union narrowing
        throw new Error(result.message ?? "Error al obtener opciones de passkey");
      }

      // After narrowing, result.type === "success" and result.options is guaranteed to exist
      const attestation = await startAuthentication({ optionsJSON: result.options });
      await loginWithPasskey(attestation, result.options.challenge);
    },
    onSuccess: () => {
      logger.info("[login-page] passkey success");
      redirectAfterSuccess();
    },
    onError: (e) => {
      logger.error("[login-page] passkey error", {
        error: e instanceof Error ? e.message : String(e),
      });
      updateState({ formError: "No se pudo validar. Usa contraseña.", step: "credentials" });
    },
  });
  return {
    state,
    isLoading: credentialsMutation.isPending || mfaMutation.isPending || passkeyMutation.isPending,
    credentialsMutation,
    mfaMutation,
    passkeyMutation,
    updateState,
    clearError,
  };
}
