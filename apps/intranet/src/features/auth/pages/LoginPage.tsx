import { Button, Form, Input, Label, Link, TextField } from "@heroui/react";
import { useLocation } from "@tanstack/react-router";
import { Fingerprint, Mail, Moon, Sun } from "lucide-react";
import type { FormEvent } from "react";
import { useSettings } from "@/context/SettingsContext";
import { useLoginLogic } from "@/features/auth/hooks/useLoginLogic";
import { useTheme } from "@/hooks/use-theme";

type LoginStep = "credentials" | "mfa" | "passkey";
export function LoginPage() {
  const { isDark, resolvedTheme, toggleTheme } = useTheme();
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
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="fixed top-4 right-4 z-10">
        <Button
          aria-label={resolvedTheme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
          className="rounded-full border border-default-200/70 bg-background/80 text-foreground shadow-sm"
          isIconOnly
          onPress={toggleTheme}
          variant="outline"
        >
          {isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        </Button>
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
            handleCredentialsSubmit={(e: React.FormEvent<HTMLFormElement>) => {
              e.preventDefault();
              clearError();
              credentialsMutation.mutate();
            }}
            handleEmailChange={(v) => updateState({ email: v })}
            handlePasswordChange={(v) => updateState({ password: v })}
            switchToPasskey={() => updateState({ step: "passkey", formError: null })}
            handleMfaSubmit={(e: React.FormEvent<HTMLFormElement>) => {
              e.preventDefault();
              clearError();
              mfaMutation.mutate();
            }}
            handleMfaCodeChange={(v) => updateState({ mfaCode: v })}
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
    </main>
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
        isDisabled={isPending}
        onPress={handlePasskeyLogin}
        size="lg"
        type="button"
        fullWidth
        aria-label="Iniciar sesión con biometría"
      >
        <Fingerprint className="size-5" aria-hidden="true" />
        {isPending ? "Verificando..." : "Ingresar con biometría"}
      </Button>

      <Button
        isDisabled={isPending}
        onPress={switchToCredentials}
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
  handleEmailChange: (value: string) => void;
  handlePasswordChange: (value: string) => void;
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
    <Form className="w-full space-y-4" onSubmit={handleCredentialsSubmit} validationBehavior="aria">
      <div className="mx-auto w-full max-w-xs">
        <TextField
          isRequired
          isDisabled={isLoading}
          name="email"
          type="email"
          value={email}
          onChange={handleEmailChange}
        >
          <Label>Correo electrónico</Label>
          <Input autoComplete="username" placeholder="usuario@bioalergia.cl" />
        </TextField>
      </div>
      <div className="mx-auto w-full max-w-xs">
        <TextField
          isDisabled={isLoading}
          name="password"
          type="password"
          value={password}
          onChange={handlePasswordChange}
        >
          <Label>Contraseña</Label>
          <Input autoComplete="current-password" enterKeyHint="go" placeholder="••••••••" />
        </TextField>
      </div>

      <div className="mx-auto w-full max-w-xs">
        <div className="flex w-full gap-2 pt-2">
          <Button
            className="h-14 min-w-0 flex-1"
            isDisabled={isLoading}
            onPress={switchToPasskey}
            type="button"
            variant="outline"
            aria-label="Volver a biometría"
          >
            Atrás
          </Button>
          <Button
            className="h-14 min-w-0 flex-1"
            isDisabled={isLoading}
            type="submit"
            aria-label="Continuar con credenciales"
          >
            {isLoading ? "Verificando..." : "Continuar"}
          </Button>
        </div>
      </div>
    </Form>
  );
}

interface MfaStepProps {
  isLoading: boolean;
  mfaCode: string;
  handleMfaSubmit: (e: FormEvent<HTMLFormElement>) => void;
  handleMfaCodeChange: (value: string) => void;
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
    <Form className="w-full space-y-4" onSubmit={handleMfaSubmit} validationBehavior="aria">
      <div className="mx-auto w-full max-w-xs">
        <TextField
          isRequired
          isDisabled={isLoading}
          name="mfaCode"
          type="text"
          value={mfaCode}
          onChange={handleMfaCodeChange}
        >
          <Label>Código de seguridad</Label>
          <Input
            autoComplete="one-time-code"
            className="text-center text-2xl tracking-widest"
            inputMode="numeric"
            maxLength={6}
            pattern="[0-9]*"
            placeholder="000000"
          />
        </TextField>
      </div>

      <div className="mx-auto w-full max-w-xs">
        <div className="flex w-full gap-2 pt-2">
          <Button
            className="h-14 min-w-0 flex-1"
            isDisabled={isLoading}
            onPress={switchToCredentialsFromMfa}
            type="button"
            variant="outline"
            aria-label="Volver a credenciales"
          >
            Atrás
          </Button>
          <Button
            className="h-14 min-w-0 flex-1"
            isDisabled={isLoading}
            type="submit"
            aria-label="Confirmar código MFA"
          >
            {isLoading ? "Verificando..." : "Confirmar"}
          </Button>
        </div>
      </div>
    </Form>
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
  handleEmailChange: (value: string) => void;
  handlePasswordChange: (value: string) => void;
  switchToPasskey: () => void;
  handleMfaSubmit: (e: FormEvent<HTMLFormElement>) => void;
  handleMfaCodeChange: (value: string) => void;
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
      className="fade-in zoom-in flex flex-col items-center justify-center gap-4 py-8 "
      aria-live="polite"
    >
      <div className="flex size-16 scale-110 items-center justify-center rounded-full bg-success-soft-hover text-success ">
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
      <Link className="font-semibold text-primary hover:underline" href={`mailto:${supportEmail}`}>
        Contacta aquí
      </Link>
    </div>
  );
}
