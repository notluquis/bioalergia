import { useLocation } from "@tanstack/react-router";
import { Fingerprint, Mail } from "lucide-react";
import type { ChangeEvent, FormEvent } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { useSettings } from "@/context/SettingsContext";
import { useLoginLogic } from "@/features/auth/hooks/useLoginLogic";

type LoginStep = "credentials" | "mfa" | "passkey";
export function LoginPage() {
  const { settings } = useSettings();
  const location = useLocation();
  const from = (location.state as null | { from?: string })?.from ?? "/";
  const fallbackLogo = "/logo_sin_eslogan.png";
  const logoSrc = settings.logoUrl.trim() || fallbackLogo;
  const {
    state,
    isLoading,
    credentialsMutation,
    mfaMutation,
    passkeyMutation,
    updateState,
    clearError,
  } = useLoginLogic(from);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="fixed top-4 right-4 z-10">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm">
        <LoginHeader
          step={state.step}
          orgName={settings.orgName}
          logoSrc={logoSrc}
          fallbackLogo={fallbackLogo}
        />

        {!state.isSuccess && (
          <LoginContent
            step={state.step}
            isLoading={isLoading}
            email={state.email}
            password={state.password}
            mfaCode={state.mfaCode}
            passkeyMutation={passkeyMutation}
            handlePasskeyLogin={() => {
              clearError();
              passkeyMutation.mutate();
            }}
            switchToCredentials={() => updateState({ step: "credentials", formError: null })}
            handleCredentialsSubmit={(e) => {
              e.preventDefault();
              clearError();
              credentialsMutation.mutate();
            }}
            handleEmailChange={(e) => updateState({ email: e.target.value })}
            handlePasswordChange={(e) => updateState({ password: e.target.value })}
            switchToPasskey={() => updateState({ step: "passkey", formError: null })}
            handleMfaSubmit={(e) => {
              e.preventDefault();
              clearError();
              mfaMutation.mutate();
            }}
            handleMfaCodeChange={(e) => updateState({ mfaCode: e.target.value })}
            switchToCredentialsFromMfa={() =>
              updateState({ step: "credentials", mfaCode: "", formError: null })
            }
          />
        )}
        {state.isSuccess && <LoginSuccess />}
        {state.formError && <LoginError error={state.formError} />}
        {state.step === "credentials" && !state.isSuccess && (
          <LoginFooter supportEmail="lpulgar@bioalergia.cl" />
        )}
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
        <h1 className="text-balance font-semibold text-2xl text-foreground">
          {step === "mfa" ? "Verifica tu identidad" : "Inicia sesión"}
        </h1>
        <p className="mt-1 text-default-500 text-sm">
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
    <div className="mx-auto w-full max-w-xs space-y-3">
      <Button
        className="gap-2 text-base"
        disabled={isPending}
        onClick={handlePasskeyLogin}
        size="lg"
        type="button"
        fullWidth
        aria-label="Iniciar sesión con biometría"
      >
        <Fingerprint className="size-5" aria-hidden="true" />
        {isPending ? "Verificando..." : "Ingresar con biometría"}
      </Button>

      <Button
        disabled={isPending}
        onClick={switchToCredentials}
        size="lg"
        type="button"
        variant="outline"
        fullWidth
        aria-label="Usar correo electrónico y contraseña"
      >
        <Mail className="size-4" aria-hidden="true" />
        <span className="font-medium text-sm">Usar correo y contraseña</span>
      </Button>
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
      <div className="mx-auto w-full max-w-xs">
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
      </div>
      <div className="mx-auto w-full max-w-xs">
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
      </div>

      <div className="mx-auto w-full max-w-xs">
        <div className="flex w-full gap-2 pt-2">
          <Button
            className="h-14 min-w-0 flex-1"
            disabled={isLoading}
            onClick={switchToPasskey}
            type="button"
            variant="ghost"
            aria-label="Volver a biometría"
          >
            Atrás
          </Button>
          <Button
            className="h-14 min-w-0 flex-1"
            disabled={isLoading}
            type="submit"
            aria-label="Continuar con credenciales"
          >
            {isLoading ? "Verificando..." : "Continuar"}
          </Button>
        </div>
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
      <div className="mx-auto w-full max-w-xs">
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
      </div>

      <div className="mx-auto w-full max-w-xs">
        <div className="flex w-full gap-2 pt-2">
          <Button
            className="h-14 min-w-0 flex-1"
            disabled={isLoading}
            onClick={switchToCredentialsFromMfa}
            type="button"
            variant="ghost"
            aria-label="Volver a credenciales"
          >
            Atrás
          </Button>
          <Button
            className="h-14 min-w-0 flex-1"
            disabled={isLoading}
            type="submit"
            aria-label="Confirmar código MFA"
          >
            {isLoading ? "Verificando..." : "Confirmar"}
          </Button>
        </div>
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
      className="fade-in zoom-in flex animate-in flex-col items-center justify-center gap-4 py-8 duration-500"
      aria-live="polite"
    >
      <div className="flex size-16 scale-110 items-center justify-center rounded-full bg-success-soft-hover text-success transition-transform duration-700">
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
        <h2 className="font-semibold text-foreground">¡Bienvenido de nuevo!</h2>
        <p className="text-default-500 text-sm">Preparando tu sesión...</p>
      </div>
    </output>
  );
}

function LoginError({ error }: { error: string }) {
  return (
    <div
      className="mt-4 rounded-lg border border-danger-soft-hover bg-danger/10 p-3 text-center text-danger text-sm"
      role="alert"
      aria-live="assertive"
    >
      {error}
    </div>
  );
}

function LoginFooter({ supportEmail }: { supportEmail: string }) {
  return (
    <div className="mt-6 text-center text-default-500 text-xs">
      ¿Problemas?{" "}
      <a className="font-semibold text-primary hover:underline" href={`mailto:${supportEmail}`}>
        Contacta aquí
      </a>
    </div>
  );
}
