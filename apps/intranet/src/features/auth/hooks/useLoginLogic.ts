import { startAuthentication } from "@simplewebauthn/browser";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { fetchPasskeyLoginOptions } from "@/features/auth/api";
import { logger } from "@/lib/logger";

export type LoginStep = "credentials" | "mfa" | "mfa_setup" | "passkey";

export interface LoginState {
  email: string;
  password: string;
  mfaCode: string;
  step: LoginStep;
  tempMfaToken: null | string;
  // Set when login returns mfa_setup_required: the enrollment token + the TOTP
  // secret/QR once the user starts setup.
  tempSetupToken: null | string;
  mfaSecret: null | { qrCodeUrl: string; secret: string };
  formError: null | string;
  isSuccess: boolean;
}

const INITIAL_STATE: LoginState = {
  email: "",
  password: "",
  mfaCode: "",
  step: "passkey",
  tempMfaToken: null,
  tempSetupToken: null,
  mfaSecret: null,
  formError: null,
  isSuccess: false,
};

export function useLoginLogic(from: string) {
  const {
    login,
    loginWithMfa,
    loginWithPasskey,
    enrollMfaBegin,
    enrollMfaComplete,
    enrollPasskey,
  } = useAuth();
  const navigate = useNavigate();
  const [state, setState] = useState<LoginState>(INITIAL_STATE);
  const { email, password, mfaCode, tempMfaToken, tempSetupToken } = state;
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
    mutationFn: async () => login(email, password),
    onSuccess: (r) => {
      if (r.status === "mfa_required") {
        updateState({ tempMfaToken: r.mfaToken, step: "mfa" });
        logger.info("[login-page] MFA required");
      } else if (r.status === "mfa_setup_required") {
        updateState({ tempSetupToken: r.setupToken, step: "mfa_setup" });
        logger.info("[login-page] MFA enrollment required");
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

  // Enrollment (step "mfa_setup"): begin generates the QR/secret; complete
  // verifies the TOTP and the server mints the session. Passkey enroll runs the
  // full ceremony. All redirect on success.
  const mfaSetupBeginMutation = useMutation({
    mutationFn: async () => {
      if (!tempSetupToken) throw new Error("No setup token");
      return enrollMfaBegin(tempSetupToken);
    },
    onSuccess: (secret) => updateState({ mfaSecret: secret }),
    onError: (e) =>
      updateState({ formError: e instanceof Error ? e.message : "No se pudo iniciar MFA" }),
  });
  const mfaEnrollMutation = useMutation({
    mutationFn: async () => {
      if (!tempSetupToken) throw new Error("No setup token");
      await enrollMfaComplete(tempSetupToken, mfaCode);
    },
    onSuccess: redirectAfterSuccess,
    onError: (e) =>
      updateState({ formError: e instanceof Error ? e.message : "Código incorrecto" }),
  });
  const passkeyEnrollMutation = useMutation({
    mutationFn: async () => {
      if (!tempSetupToken) throw new Error("No setup token");
      await enrollPasskey(tempSetupToken);
    },
    onSuccess: redirectAfterSuccess,
    onError: (e) =>
      updateState({
        formError: e instanceof Error ? e.message : "No se pudo registrar el passkey",
      }),
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
    isLoading:
      credentialsMutation.isPending ||
      mfaMutation.isPending ||
      passkeyMutation.isPending ||
      mfaSetupBeginMutation.isPending ||
      mfaEnrollMutation.isPending ||
      passkeyEnrollMutation.isPending,
    credentialsMutation,
    mfaMutation,
    passkeyMutation,
    mfaSetupBeginMutation,
    mfaEnrollMutation,
    passkeyEnrollMutation,
    updateState,
    clearError,
  };
}
