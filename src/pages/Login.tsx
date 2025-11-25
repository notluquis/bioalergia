import { useState } from "react";
import type { ChangeEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { startAuthentication } from "@simplewebauthn/browser";
import { Fingerprint, Smartphone } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useSettings } from "../context/SettingsContext";
import { logger } from "../lib/logger";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import ConnectionIndicator from "../components/features/ConnectionIndicator";
import { useToast } from "../context/ToastContext";

export default function Login() {
  const { login, loginWithMfa, loginWithPasskey } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const location = useLocation();
  const { error: toastError } = useToast();

  // Login State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");

  // UI State
  const [step, setStep] = useState<"credentials" | "mfa">("credentials");
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

      navigate(from, { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo iniciar sesión";
      toastError(message);
      setFormError(message);
      logger.error("[login-page] login error", { email, message });
    } finally {
      if (step === "credentials") setLoading(false);
    }
  };

  const handleMfaSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!tempUserId) return;

    setLoading(true);
    setFormError(null);
    try {
      await loginWithMfa(tempUserId, mfaCode);
      navigate(from, { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Código incorrecto";
      setFormError(message);
      setLoading(false);
    }
  };

  const handlePasskeyLogin = async () => {
    setLoading(true);
    setFormError(null);
    try {
      // 1. Get options from server
      const resp = await fetch("/api/auth/passkey/login/options");
      const options = await resp.json();

      // 2. Browser native auth
      const authResp = await startAuthentication(options);

      // 3. Verify with server
      await loginWithPasskey(authResp, options.challenge);

      navigate(from, { replace: true });
    } catch (err) {
      console.error(err);
      setFormError("No se pudo validar el acceso biométrico. Usa tu contraseña.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-linear-to-br from-base-200/60 via-base-100 to-base-100 px-6 py-12">
      <div className="surface-elevated relative z-10 w-full max-w-md rounded-[1.75rem] px-10 py-12 shadow-2xl">
        <div className="mb-6 flex justify-end">
          <ConnectionIndicator />
        </div>

        <div className="flex flex-col items-center gap-3 text-center">
          <img
            src={logoSrc}
            alt={settings.orgName || "Bioalergia"}
            className="brand-logo"
            onError={(event) => {
              if (event.currentTarget.src !== fallbackLogo) {
                event.currentTarget.src = fallbackLogo;
              }
            }}
          />
          <h1 className="text-xl font-semibold text-primary drop-shadow-sm">
            {step === "mfa" ? "Verificación de seguridad" : `Inicia sesión en ${settings.orgName}`}
          </h1>
          <p className="text-sm text-base-content/90">
            {step === "mfa"
              ? "Ingresa el código de 6 dígitos de tu aplicación autenticadora."
              : "Usa tu correo corporativo para continuar."}
          </p>
        </div>

        {step === "credentials" ? (
          <div className="mt-8 space-y-5">
            <form onSubmit={handleCredentialsSubmit} className="space-y-5">
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
                required
              />

              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Verificando..." : "Ingresar"}
              </Button>
            </form>

            <div className="relative flex items-center py-2">
              <div className="grow border-t border-base-300"></div>
              <span className="mx-4 shrink text-xs text-base-content/50">O ingresa con</span>
              <div className="grow border-t border-base-300"></div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full gap-2"
              onClick={handlePasskeyLogin}
              disabled={loading}
            >
              <Fingerprint className="size-4" />
              <span className="hidden sm:inline">Passkey / Biometría</span>
              <span className="sm:hidden">Biometría</span>
            </Button>
          </div>
        ) : (
          <form onSubmit={handleMfaSubmit} className="mt-8 space-y-5">
            <div className="flex justify-center">
              <Smartphone className="size-12 text-primary/20" />
            </div>
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
              autoFocus
              required
            />

            <div className="flex flex-col gap-3 pt-4">
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Verificando..." : "Confirmar"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setStep("credentials");
                  setMfaCode("");
                  setFormError(null);
                }}
                disabled={loading}
                className="w-full"
              >
                Volver
              </Button>
            </div>
          </form>
        )}

        {formError && <p className="mt-4 text-center text-xs text-rose-500">{formError}</p>}

        {step === "credentials" && (
          <p className="mt-8 text-center text-xs text-base-content/90">
            ¿Olvidaste tu contraseña?{" "}
            <a href={`mailto:${supportEmail}`} className="font-semibold text-primary underline">
              Contacta al administrador
            </a>
          </p>
        )}
      </div>
    </div>
  );
}
