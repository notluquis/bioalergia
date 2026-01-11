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
  const [step, setStep] = useState<"passkey" | "credentials" | "mfa">("passkey");
  const [tempUserId, setTempUserId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fallbackLogo = "/logo_sin_eslogan.png";
  const logoSrc = settings.logoUrl?.trim() || fallbackLogo;
  const supportEmail = "lpulgar@bioalergia.cl";

  const from = (location.state as { from?: string } | null)?.from ?? "/";

  const handleCredentialsSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setFormError(null);
    try {
      const result = await login(email, password);

      if (result?.status === "mfa_required" && result.userId) {
        setTempUserId(result.userId);
        setStep("mfa");
        setLoading(false);
        return;
      }

      logger.info("[login-page] redirecting after successful login", { user: email, to: from });
      navigate({ to: from as "/", replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo iniciar sesión";
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
      logger.info("[login-page] redirecting after successful mfa login", { userId: tempUserId, to: from });
      navigate({ to: from as "/", replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Código incorrecto";
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
    onSuccess: () => {
      logger.info("[login-page] redirecting after successful passkey login", { to: from });
      navigate({ to: from as "/", replace: true });
    },
    onError: (err) => {
      console.error(err);
      setFormError("No se pudo validar el acceso biométrico. Usa tu contraseña.");
      setStep("credentials");
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
            src={logoSrc}
            alt={settings.orgName || "Bioalergia"}
            className="brand-logo h-16"
            onError={(event) => {
              if (event.currentTarget.src !== fallbackLogo) {
                event.currentTarget.src = fallbackLogo;
              }
            }}
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
        {step === "passkey" && (
          <div className="space-y-3">
            <Button
              type="button"
              className="h-14 w-full gap-2 text-base"
              onClick={handlePasskeyLogin}
              disabled={passkeyLoginMutation.isPending}
            >
              <Fingerprint className="size-5" />
              {passkeyLoginMutation.isPending ? "Verificando..." : "Ingresar con biometría"}
            </Button>

            <button
              type="button"
              onClick={() => {
                setStep("credentials");
                setFormError(null);
              }}
              disabled={passkeyLoginMutation.isPending}
              className="border-base-300 hover:bg-base-200 flex h-12 w-full items-center justify-center gap-2 rounded-lg border transition-colors disabled:opacity-50"
            >
              <Mail className="size-4" />
              <span className="text-sm font-medium">Usar correo y contraseña</span>
            </button>
          </div>
        )}

        {step === "credentials" && (
          <form onSubmit={handleCredentialsSubmit} className="space-y-4">
            <Input
              label="Correo electrónico"
              type="email"
              value={email}
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                setEmail(event.target.value);
                if (formError) setFormError(null);
              }}
              placeholder="usuario@bioalergia.cl"
              autoComplete="username"
              required
            />
            <Input
              label="Contraseña"
              type="password"
              value={password}
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                setPassword(event.target.value);
                if (formError) setFormError(null);
              }}
              placeholder="••••••••"
              autoComplete="current-password"
              enterKeyHint="go"
            />

            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setStep("passkey");
                  setFormError(null);
                }}
                disabled={loading}
                className="flex-1"
              >
                Atrás
              </Button>
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? "Verificando..." : "Continuar"}
              </Button>
            </div>
          </form>
        )}

        {step === "mfa" && (
          <form onSubmit={handleMfaSubmit} className="space-y-4">
            <Input
              label="Código de seguridad"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={mfaCode}
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                setMfaCode(event.target.value);
                if (formError) setFormError(null);
              }}
              placeholder="000000"
              autoComplete="one-time-code"
              className="text-center text-2xl tracking-widest"
              required
            />

            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setStep("credentials");
                  setMfaCode("");
                  setFormError(null);
                }}
                disabled={loading}
                className="flex-1"
              >
                Atrás
              </Button>
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? "Verificando..." : "Confirmar"}
              </Button>
            </div>
          </form>
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
            <a href={`mailto:${supportEmail}`} className="text-primary font-semibold hover:underline">
              Contacta aquí
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
