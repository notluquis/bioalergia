import { startAuthentication } from "@simplewebauthn/browser";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { fetchPasskeyLoginOptions } from "@/features/auth/api";
import { logger } from "@/lib/logger";

export type LoginStep = "credentials" | "mfa" | "passkey";

export interface LoginState {
  email: string;
  password: string;
  mfaCode: string;
  step: LoginStep;
  tempUserId: null | number;
  formError: null | string;
  isSuccess: boolean;
}

const INITIAL_STATE: LoginState = {
  email: "",
  password: "",
  mfaCode: "",
  step: "passkey",
  tempUserId: null,
  formError: null,
  isSuccess: false,
};

export function useLoginLogic(from: string) {
  const { login, loginWithMfa, loginWithPasskey } = useAuth();
  const navigate = useNavigate();
  const [state, setState] = useState<LoginState>(INITIAL_STATE);
  const { email, password, mfaCode, tempUserId } = state;
  const updateState = useCallback(
    (updates: Partial<LoginState>) => setState((p) => ({ ...p, ...updates })),
    [],
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
        ? { requiresMfa: true, userId: r.userId }
        : { requiresMfa: false };
    },
    onSuccess: (d) => {
      if (d.requiresMfa) updateState({ tempUserId: d.userId, step: "mfa" });
      else redirectAfterSuccess();
    },
    onError: (e) => updateState({ formError: e instanceof Error ? e.message : "Error" }),
  });
  const mfaMutation = useMutation({
    mutationFn: async () => {
      if (!tempUserId) throw new Error("No user");
      await loginWithMfa(tempUserId, mfaCode);
    },
    onSuccess: () => redirectAfterSuccess(),
    onError: (e) =>
      updateState({ formError: e instanceof Error ? e.message : "Código incorrecto" }),
  });
  const passkeyMutation = useMutation({
    mutationFn: async () => {
      const o = await fetchPasskeyLoginOptions();
      if (!o?.challenge) throw new Error("Invalid");
      const a = await startAuthentication({ optionsJSON: o });
      await loginWithPasskey(a, o.challenge);
    },
    onSuccess: () => redirectAfterSuccess(),
    onError: () =>
      updateState({ formError: "No se pudo validar. Usa contraseña.", step: "credentials" }),
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
