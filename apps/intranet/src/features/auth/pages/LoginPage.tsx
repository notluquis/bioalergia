import { startAuthentication } from "@simplewebauthn/browser";
import { useMutation } from "@tanstack/react-query";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { Fingerprint, Mail } from "lucide-react";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useState } from "react";

import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { useAuth } from "@/context/AuthContext";
import { useSettings } from "@/context/SettingsContext";
import { fetchPasskeyLoginOptions } from "@/features/auth/api";
import { logger } from "@/lib/logger";

type LoginStep = "credentials" | "mfa" | "passkey";

interface LoginState {
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

const REDIRECT_DELAY_MS = 800;

export default function LoginPage() {
  const { login, loginWithMfa, loginWithPasskey } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const location = useLocation();

  const [state, setState] = useState<LoginState>(INITIAL_STATE);
  const { email, password, mfaCode, step, tempUserId, formError, isSuccess } = state;

  const fallbackLogo = "/logo_sin_eslogan.png";
  const logoSrc = settings.logoUrl.trim() || fallbackLogo;
  const supportEmail = "lpulgar@bioalergia.cl";

  const from = (location.state as null | { from?: string })?.from ?? "/";

  // Memoized update functions
  const updateState = useCallback((updates: Partial<LoginState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  const clearError = useCallback(() => {
    updateState({ formError: null });
  }, [updateState]);

  const redirectAfterSuccess = useCallback(() => {
    updateState({ isSuccess: true });
    setTimeout(() => {
      logger.info("[login-page] redirecting after success", { to: from });
      void navigate({ replace: true, to: from as "/" });
    }, REDIRECT_DELAY_MS);
  }, [from, navigate, updateState]);

  // Credentials login mutation
  const credentialsMutation = useMutation({
    mutationFn: async () => {
      const result = await login(email, password);

      if (result.status === "mfa_required" && result.userId) {
        return { requiresMfa: true, userId: result.userId };
      }

      return { requiresMfa: false };
    },
    onSuccess: (data) => {
      if (data.requiresMfa) {
        updateState({ tempUserId: data.userId, step: "mfa" });
        logger.info("[login-page] MFA required", { userId: data.userId });
      } else {
        logger.info("[login-page] credentials login success", { user: email });
        redirectAfterSuccess();
      }
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "No se pudo iniciar sesión";
      updateState({ formError: message });
      logger.error("[login-page] credentials login error", { email, message });
    },
  });

  // MFA login mutation
  const mfaMutation = useMutation({
    mutationFn: async () => {
      if (!tempUserId) throw new Error("User ID not found");
      await loginWithMfa(tempUserId, mfaCode);
    },
    onSuccess: () => {
      logger.info("[login-page] MFA success", { userId: tempUserId });
      redirectAfterSuccess();
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Código incorrecto";
      updateState({ formError: message });
      logger.error("[login-page] MFA error", { message });
    },
  });

  // Passkey login mutation
  const passkeyMutation = useMutation({
    mutationFn: async () => {
      const options = await fetchPasskeyLoginOptions();

      if (!options?.challenge) {
        logger.error("[login-page] passkey options missing challenge", { options });
        throw new Error("Opciones de biometría incompletas");
      }

      const authResp = await startAuthentication({ optionsJSON: options });
      await loginWithPasskey(authResp, options.challenge);
    },
    onSuccess: () => {
      logger.info("[login-page] passkey success");
      redirectAfterSuccess();
    },
    onError: (error) => {
      const message = "No se pudo validar el acceso biométrico. Usa tu contraseña.";
      logger.error("[login-page] passkey error", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      updateState({ formError: message, step: "credentials" });
    },
  });

  // Event handlers
  const handleCredentialsSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      clearError();
      credentialsMutation.mutate();
    },
    [clearError, credentialsMutation],
  );

  const handleMfaSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      clearError();
      mfaMutation.mutate();
    },
    [clearError, mfaMutation],
  );

  const handlePasskeyLogin = useCallback(() => {
    clearError();
    passkeyMutation.mutate();
  }, [clearError, passkeyMutation]);

  const handleEmailChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      updateState({ email: event.target.value });
      clearError();
    },
    [clearError, updateState],
  );

  const handlePasswordChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      updateState({ password: event.target.value });
      clearError();
    },
    [clearError, updateState],
  );

  const handleMfaCodeChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      updateState({ mfaCode: event.target.value });
      clearError();
    },
    [clearError, updateState],
  );

  const switchToCredentials = useCallback(() => {
    updateState({ step: "credentials", formError: null });
  }, [updateState]);

  const switchToPasskey = useCallback(() => {
    updateState({ step: "passkey", formError: null });
  }, [updateState]);

  const switchToCredentialsFromMfa = useCallback(() => {
    updateState({ step: "credentials", mfaCode: "", formError: null });
  }, [updateState]);

  const isLoading =
    credentialsMutation.isPending || mfaMutation.isPending || passkeyMutation.isPending;

  return (
    <div className="bg-background flex min-h-screen items-center justify-center px-4 py-10">
      {/* Floating theme toggle - top right */}
      <div className="fixed top-4 right-4 z-10">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-sm">
        {/* Header */}
        <LoginHeader
          step={step}
          orgName={settings.orgName}
          logoSrc={logoSrc}
          fallbackLogo={fallbackLogo}
        />

        {/* Content */}
        {isSuccess ? null : (
          <LoginContent
            step={step}
            isLoading={isLoading}
            email={email}
            password={password}
            mfaCode={mfaCode}
            passkeyMutation={passkeyMutation}
            handlePasskeyLogin={handlePasskeyLogin}
            switchToCredentials={switchToCredentials}
            handleCredentialsSubmit={handleCredentialsSubmit}
            handleEmailChange={handleEmailChange}
            handlePasswordChange={handlePasswordChange}
            switchToPasskey={switchToPasskey}
            handleMfaSubmit={handleMfaSubmit}
            handleMfaCodeChange={handleMfaCodeChange}
            switchToCredentialsFromMfa={switchToCredentialsFromMfa}
          />
        )}

        {/* Success Transition */}
        {isSuccess && <LoginSuccess />}

        {/* Error */}
        {formError && <LoginError error={formError} />}

        {/* Footer */}
        {step === "credentials" && !isSuccess && <LoginFooter supportEmail={supportEmail} />}
      </div>
    </div>
  );
}

// ========== SUB-COMPONENTS ==========

interface LoginHeaderProps {
  step: LoginStep;
  orgName?: string;
  logoSrc: string;
  fallbackLogo: string;
}

function LoginHeader({ step, orgName, logoSrc, fallbackLogo }: LoginHeaderProps) {
  return (
    <div className="mb-8 flex flex-col items-center gap-4 text-center">
      <img
        alt={orgName || "Bioalergia"}
        className="brand-logo h-16"
        onError={(event) => {
          if (event.currentTarget.src !== fallbackLogo) {
            event.currentTarget.src = fallbackLogo;
          }
        }}
        src={logoSrc}
      />
      <div>
        <h1 className="text-foreground text-2xl font-semibold text-balance">
          {step === "mfa" ? "Verifica tu identidad" : "Inicia sesión"}
        </h1>
        <p className="text-default-500 mt-1 text-sm">
          {step === "passkey" && "Usa tu biometría para acceder"}
          {step === "credentials" && "Ingresa tus credenciales"}
          {step === "mfa" && "Código de 6 dígitos"}
        </p>
      </div>
    </div>
  );
}

interface PasskeyStepProps {
  isPending: boolean;
  handlePasskeyLogin: () => void;
  switchToCredentials: () => void;
}

function PasskeyStep({ isPending, handlePasskeyLogin, switchToCredentials }: PasskeyStepProps) {
  return (
    <div className="space-y-3">
      <Button
        className="h-14 w-full gap-2 text-base"
        disabled={isPending}
        onClick={handlePasskeyLogin}
        type="button"
        aria-label="Iniciar sesión con biometría"
      >
        <Fingerprint className="size-5" aria-hidden="true" />
        {isPending ? "Verificando..." : "Ingresar con biometría"}
      </Button>

      <button
        className="border-default-200 hover:bg-default-50 flex h-14 w-full items-center justify-center gap-2 rounded-lg border transition-colors disabled:opacity-50"
        disabled={isPending}
        onClick={switchToCredentials}
        type="button"
        aria-label="Usar correo electrónico y contraseña"
      >
        <Mail className="size-4" aria-hidden="true" />
        <span className="text-sm font-medium">Usar correo y contraseña</span>
      </button>
    </div>
  );
}

interface CredentialsStepProps {
  isLoading: boolean;
  email: string;
  password: string;
  handleCredentialsSubmit: (e: FormEvent<HTMLFormElement>) => void;
  handleEmailChange: (e: ChangeEvent<HTMLInputElement>) => void;
  handlePasswordChange: (e: ChangeEvent<HTMLInputElement>) => void;
  switchToPasskey: () => void;
}

function CredentialsStep({
  isLoading,
  email,
  password,
  handleCredentialsSubmit,
  handleEmailChange,
  handlePasswordChange,
  switchToPasskey,
}: CredentialsStepProps) {
  return (
    <form className="w-full space-y-4" onSubmit={handleCredentialsSubmit}>
      <Input
        autoComplete="username"
        label="Correo electrónico"
        onChange={handleEmailChange}
        placeholder="usuario@bioalergia.cl"
        required
        type="email"
        value={email}
        disabled={isLoading}
      />
      <Input
        autoComplete="current-password"
        enterKeyHint="go"
        label="Contraseña"
        onChange={handlePasswordChange}
        placeholder="••••••••"
        type="password"
        value={password}
        disabled={isLoading}
      />

      <div className="flex w-full gap-2 pt-2">
        <Button
          className="h-14 flex-1 min-w-0"
          disabled={isLoading}
          onClick={switchToPasskey}
          type="button"
          variant="ghost"
          aria-label="Volver a biometría"
        >
          Atrás
        </Button>
        <Button
          className="h-14 flex-1 min-w-0"
          disabled={isLoading}
          type="submit"
          aria-label="Continuar con credenciales"
        >
          {isLoading ? "Verificando..." : "Continuar"}
        </Button>
      </div>
    </form>
  );
}

interface MfaStepProps {
  isLoading: boolean;
  mfaCode: string;
  handleMfaSubmit: (e: FormEvent<HTMLFormElement>) => void;
  handleMfaCodeChange: (e: ChangeEvent<HTMLInputElement>) => void;
  switchToCredentialsFromMfa: () => void;
}

function MfaStep({
  isLoading,
  mfaCode,
  handleMfaSubmit,
  handleMfaCodeChange,
  switchToCredentialsFromMfa,
}: MfaStepProps) {
  return (
    <form className="w-full space-y-4" onSubmit={handleMfaSubmit}>
      <Input
        autoComplete="one-time-code"
        className="text-center text-2xl tracking-widest"
        inputMode="numeric"
        label="Código de seguridad"
        maxLength={6}
        onChange={handleMfaCodeChange}
        pattern="[0-9]*"
        placeholder="000000"
        required
        type="text"
        value={mfaCode}
        disabled={isLoading}
      />

      <div className="flex w-full gap-2 pt-2">
        <Button
          className="h-14 flex-1 min-w-0"
          disabled={isLoading}
          onClick={switchToCredentialsFromMfa}
          type="button"
          variant="ghost"
          aria-label="Volver a credenciales"
        >
          Atrás
        </Button>
        <Button
          className="h-14 flex-1 min-w-0"
          disabled={isLoading}
          type="submit"
          aria-label="Confirmar código MFA"
        >
          {isLoading ? "Verificando..." : "Confirmar"}
        </Button>
      </div>
    </form>
  );
}

interface LoginContentProps {
  step: LoginStep;
  isLoading: boolean;
  email: string;
  password: string;
  mfaCode: string;
  passkeyMutation: { isPending: boolean };
  handlePasskeyLogin: () => void;
  switchToCredentials: () => void;
  handleCredentialsSubmit: (e: FormEvent<HTMLFormElement>) => void;
  handleEmailChange: (e: ChangeEvent<HTMLInputElement>) => void;
  handlePasswordChange: (e: ChangeEvent<HTMLInputElement>) => void;
  switchToPasskey: () => void;
  handleMfaSubmit: (e: FormEvent<HTMLFormElement>) => void;
  handleMfaCodeChange: (e: ChangeEvent<HTMLInputElement>) => void;
  switchToCredentialsFromMfa: () => void;
}

function LoginContent({
  step,
  isLoading,
  email,
  password,
  mfaCode,
  passkeyMutation,
  handlePasskeyLogin,
  switchToCredentials,
  handleCredentialsSubmit,
  handleEmailChange,
  handlePasswordChange,
  switchToPasskey,
  handleMfaSubmit,
  handleMfaCodeChange,
  switchToCredentialsFromMfa,
}: LoginContentProps) {
  if (step === "passkey") {
    return (
      <PasskeyStep
        isPending={passkeyMutation.isPending}
        handlePasskeyLogin={handlePasskeyLogin}
        switchToCredentials={switchToCredentials}
      />
    );
  }

  if (step === "credentials") {
    return (
      <CredentialsStep
        isLoading={isLoading}
        email={email}
        password={password}
        handleCredentialsSubmit={handleCredentialsSubmit}
        handleEmailChange={handleEmailChange}
        handlePasswordChange={handlePasswordChange}
        switchToPasskey={switchToPasskey}
      />
    );
  }

  if (step === "mfa") {
    return (
      <MfaStep
        isLoading={isLoading}
        mfaCode={mfaCode}
        handleMfaSubmit={handleMfaSubmit}
        handleMfaCodeChange={handleMfaCodeChange}
        switchToCredentialsFromMfa={switchToCredentialsFromMfa}
      />
    );
  }

  return null;
}

function LoginSuccess() {
  return (
    <output
      className="animate-in fade-in zoom-in flex flex-col items-center justify-center gap-4 py-8 duration-500"
      aria-live="polite"
    >
      <div className="bg-success-soft-hover text-success flex size-16 scale-110 items-center justify-center rounded-full transition-transform duration-700">
        <svg
          className="size-8"
          fill="none"
          stroke="currentColor"
          strokeWidth={3}
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <title>Éxito</title>
          <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div className="text-center">
        <h2 className="text-foreground font-semibold">¡Bienvenido de nuevo!</h2>
        <p className="text-default-500 text-sm">Preparando tu sesión...</p>
      </div>
    </output>
  );
}

function LoginError({ error }: { error: string }) {
  return (
    <div
      className="bg-danger/10 border-danger-soft-hover text-danger mt-4 rounded-lg border p-3 text-center text-sm"
      role="alert"
      aria-live="assertive"
    >
      {error}
    </div>
  );
}

function LoginFooter({ supportEmail }: { supportEmail: string }) {
  return (
    <div className="text-default-500 mt-6 text-center text-xs">
      ¿Problemas?{" "}
      <a className="text-primary font-semibold hover:underline" href={`mailto:${supportEmail}`}>
        Contacta aquí
      </a>
    </div>
  );
}
