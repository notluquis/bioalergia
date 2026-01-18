import { startAuthentication } from "@simplewebauthn/browser";
import { useMutation } from "@tanstack/react-query";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { Fingerprint, Mail } from "lucide-react";
import type { ChangeEvent } from "react";
import { useState } from "react";

import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { useAuth } from "@/context/AuthContext";
import { useSettings } from "@/context/SettingsContext";
import { fetchPasskeyLoginOptions } from "@/features/auth/api";
import { logger } from "@/lib/logger";

export default function LoginPage() {
  const { login, loginWithMfa, loginWithPasskey } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const location = useLocation();

  // Login State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");

  // UI State
  const [step, setStep] = useState<"credentials" | "mfa" | "passkey">("passkey");
  const [tempUserId, setTempUserId] = useState<null | number>(null);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<null | string>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const fallbackLogo = "/logo_sin_eslogan.png";
  const logoSrc = settings.logoUrl.trim() || fallbackLogo;
  const supportEmail = "lpulgar@bioalergia.cl";

  const from = (location.state as null | { from?: string })?.from ?? "/";

  const handleCredentialsSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setFormError(null);
    try {
      const result = await login(email, password);

      if (result.status === "mfa_required" && result.userId) {
        setTempUserId(result.userId);
        setStep("mfa");
        setLoading(false);
        return;
      }

      logger.info("[login-page] login success, showing transition", { user: email });
      setIsSuccess(true);
      // Small delay for harmonic transition
      setTimeout(() => {
        logger.info("[login-page] redirecting", { to: from });
        void navigate({ replace: true, to: from as "/" });
      }, 800);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo iniciar sesión";
      setFormError(message);
      logger.error("[login-page] login error", { email, message });
      setLoading(false);
    }
  };

  const handleMfaSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!tempUserId) return;

    setLoading(true);
    setFormError(null);
    try {
      await loginWithMfa(tempUserId, mfaCode);
      logger.info("[login-page] mfa success, showing transition", { userId: tempUserId });
      setIsSuccess(true);
      setTimeout(() => {
        logger.info("[login-page] redirecting", { to: from });
        void navigate({ replace: true, to: from as "/" });
      }, 800);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Código incorrecto";
      setFormError(message);
      setLoading(false);
    }
  };

  const passkeyLoginMutation = useMutation({
    mutationFn: async () => {
      const options = await fetchPasskeyLoginOptions();

      if (!options.challenge) {
        throw new Error("Error al obtener opciones de biometría");
      }

      const authResp = await startAuthentication({ optionsJSON: options });
      await loginWithPasskey(authResp, options.challenge);
    },
    onError: (err) => {
      console.error(err);
      setFormError("No se pudo validar el acceso biométrico. Usa tu contraseña.");
      setStep("credentials");
    },
    onSuccess: () => {
      logger.info("[login-page] passkey success, showing transition");
      setIsSuccess(true);
      setTimeout(() => {
        logger.info("[login-page] redirecting", { to: from });
        void navigate({ replace: true, to: from as "/" });
      }, 800);
    },
  });

  const handlePasskeyLogin = () => {
    setFormError(null);
    passkeyLoginMutation.mutate();
  };

  return (
    <div className="bg-base-100 flex min-h-screen items-center justify-center px-4 py-10">
      {/* Floating theme toggle - top right */}
      <div className="fixed top-4 right-4 z-10">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <img
            alt={settings.orgName || "Bioalergia"}
            className="brand-logo h-16"
            onError={(event) => {
              if (event.currentTarget.src !== fallbackLogo) {
                event.currentTarget.src = fallbackLogo;
              }
            }}
            src={logoSrc}
          />
          <div>
            <h1 className="text-base-content text-2xl font-semibold text-balance">
              {step === "mfa" ? "Verifica tu identidad" : "Inicia sesión"}
            </h1>
            <p className="text-base-content/60 mt-1 text-sm">
              {step === "passkey" && "Usa tu biometría para acceder"}
              {step === "credentials" && "Ingresa tus credenciales"}
              {step === "mfa" && "Código de 6 dígitos"}
            </p>
          </div>
        </div>

        {/* Content */}
        {isSuccess
          ? null
          : step === "passkey" && (
              <div className="space-y-3">
                <Button
                  className="h-14 w-full gap-2 text-base"
                  disabled={passkeyLoginMutation.isPending}
                  onClick={handlePasskeyLogin}
                  type="button"
                >
                  <Fingerprint className="size-5" />
                  {passkeyLoginMutation.isPending ? "Verificando..." : "Ingresar con biometría"}
                </Button>

                <button
                  className="border-base-300 hover:bg-base-200 flex h-12 w-full items-center justify-center gap-2 rounded-lg border transition-colors disabled:opacity-50"
                  disabled={passkeyLoginMutation.isPending}
                  onClick={() => {
                    setStep("credentials");
                    setFormError(null);
                  }}
                  type="button"
                >
                  <Mail className="size-4" />
                  <span className="text-sm font-medium">Usar correo y contraseña</span>
                </button>
              </div>
            )}

        {step === "credentials" && !isSuccess && (
          <form className="space-y-4" onSubmit={handleCredentialsSubmit}>
            <Input
              autoComplete="username"
              label="Correo electrónico"
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                setEmail(event.target.value);
                if (formError) setFormError(null);
              }}
              placeholder="usuario@bioalergia.cl"
              required
              type="email"
              value={email}
            />
            <Input
              autoComplete="current-password"
              enterKeyHint="go"
              label="Contraseña"
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                setPassword(event.target.value);
                if (formError) setFormError(null);
              }}
              placeholder="••••••••"
              type="password"
              value={password}
            />

            <div className="flex gap-2 pt-2">
              <Button
                className="flex-1"
                disabled={loading}
                onClick={() => {
                  setStep("passkey");
                  setFormError(null);
                }}
                type="button"
                variant="ghost"
              >
                Atrás
              </Button>
              <Button className="flex-1" disabled={loading} type="submit">
                {loading ? "Verificando..." : "Continuar"}
              </Button>
            </div>
          </form>
        )}

        {step === "mfa" && !isSuccess && (
          <form className="space-y-4" onSubmit={handleMfaSubmit}>
            <Input
              autoComplete="one-time-code"
              className="text-center text-2xl tracking-widest"
              inputMode="numeric"
              label="Código de seguridad"
              maxLength={6}
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                setMfaCode(event.target.value);
                if (formError) setFormError(null);
              }}
              pattern="[0-9]*"
              placeholder="000000"
              required
              type="text"
              value={mfaCode}
            />

            <div className="flex gap-2 pt-2">
              <Button
                className="flex-1"
                disabled={loading}
                onClick={() => {
                  setStep("credentials");
                  setMfaCode("");
                  setFormError(null);
                }}
                type="button"
                variant="ghost"
              >
                Atrás
              </Button>
              <Button className="flex-1" disabled={loading} type="submit">
                {loading ? "Verificando..." : "Confirmar"}
              </Button>
            </div>
          </form>
        )}

        {/* Success Transition */}
        {isSuccess && (
          <div className="animate-in fade-in zoom-in flex flex-col items-center justify-center gap-4 py-8 duration-500">
            <div className="bg-success-soft-hover text-success flex size-16 scale-110 items-center justify-center rounded-full transition-transform duration-700">
              <svg className="size-8" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="text-center">
              <h2 className="text-base-content font-semibold">¡Bienvenido de nuevo!</h2>
              <p className="text-base-content/60 text-sm">Preparando tu sesión...</p>
            </div>
          </div>
        )}

        {/* Error */}
        {formError && (
          <div className="bg-error/10 border-error/20 text-error mt-4 rounded-lg border p-3 text-center text-sm">
            {formError}
          </div>
        )}

        {/* Footer */}
        {step === "credentials" && (
          <div className="text-base-content/60 mt-6 text-center text-xs">
            ¿Problemas?{" "}
            <a className="text-primary font-semibold hover:underline" href={`mailto:${supportEmail}`}>
              Contacta aquí
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
