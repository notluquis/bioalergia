import { useState } from "react";
import type { ChangeEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { startAuthentication } from "@simplewebauthn/browser";
import type { PublicKeyCredentialCreationOptionsJSON } from "@simplewebauthn/types";
import { Fingerprint, Smartphone } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useSettings } from "@/context/SettingsContext";
import { logger } from "@/lib/logger";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import ConnectionIndicator from "@/components/features/ConnectionIndicator";
import { useToast } from "@/context/ToastContext";
import { apiClient } from "@/lib/apiClient";

export default function LoginPage() {
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
      type PasskeyLoginOptions = PublicKeyCredentialCreationOptionsJSON & {
        challenge: string;
      };
      const options = await apiClient.get<PasskeyLoginOptions>("/api/auth/passkey/login/options");

      if (!options.challenge) {
        throw new Error("Error al obtener opciones de biometría");
      }

      // 2. Browser native auth
      const authResp = await startAuthentication({ optionsJSON: options });

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
    <div className="bg-base-200 relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10 sm:px-8">
      <div className="pointer-events-none absolute inset-0 opacity-60 blur-3xl">
        <div className="from-primary/10 via-secondary/5 to-accent/10 absolute top-0 -left-20 h-64 w-64 rounded-full bg-linear-to-br" />
        <div className="from-secondary/10 via-primary/5 to-info/10 absolute -right-24 bottom-0 h-72 w-72 rounded-full bg-linear-to-tr" />
      </div>

      <div className="card border-base-200/70 bg-base-100/95 relative z-10 w-full max-w-lg border shadow-2xl backdrop-blur">
        <div className="flex items-center justify-between px-8 pt-8">
          <div className="text-base-content/70 flex flex-col gap-1 text-xs">
            <span className="text-base-content font-semibold">Portal Seguro</span>
            <span className="text-base-content/60 text-[11px]">Tus credenciales están cifradas</span>
          </div>
          <ConnectionIndicator />
        </div>

        <div className="flex flex-col items-center gap-3 px-8 pt-6 text-center">
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
          <h1 className="text-primary text-2xl font-semibold break-all drop-shadow-sm">
            {step === "mfa" ? "Verificación de seguridad" : `Inicia sesión en ${settings.orgName || "Bioalergia"}`}
          </h1>
          <p className="text-base-content/80 text-sm">
            {step === "mfa"
              ? "Ingresa el código de 6 dígitos de tu app autenticadora."
              : "Usa tu correo corporativo o tu biometría para continuar."}
          </p>
        </div>

        {step === "credentials" ? (
          <div className="mt-8 space-y-5 px-8 pb-8">
            <div className="bg-base-200/60 text-base-content/70 rounded-2xl p-4 text-left text-xs">
              <p className="text-base-content font-semibold">Consejo:</p>
              <ul className="mt-2 list-disc space-y-1 pl-4">
                <li>Habilita Passkey/biometría para acceso rápido y seguro.</li>
                <li>No compartas tu contraseña; puedes resetearla con el administrador.</li>
              </ul>
            </div>

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
                required
              />

              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Verificando..." : "Ingresar"}
              </Button>
            </form>

            <div className="relative flex items-center py-1">
              <div className="border-base-300 grow border-t"></div>
              <span className="text-base-content/50 mx-4 shrink text-xs">O usa</span>
              <div className="border-base-300 grow border-t"></div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full gap-2"
              onClick={handlePasskeyLogin}
              disabled={loading}
            >
              <Fingerprint className="size-4" />
              <span className="hidden sm:inline">Passkey / Biometría (recomendado)</span>
              <span className="sm:hidden">Biometría</span>
            </Button>
          </div>
        ) : (
          <form onSubmit={handleMfaSubmit} className="mt-8 space-y-5 px-8 pb-8">
            <div className="flex justify-center">
              <Smartphone className="text-primary/40 size-12" />
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

        {formError && <p className="text-error px-8 pb-4 text-center text-sm">{formError}</p>}

        {step === "credentials" && (
          <div className="px-8 pb-8">
            <div className="divider text-base-content/60 text-xs">¿Necesitas ayuda?</div>
            <p className="text-base-content/80 text-center text-xs">
              ¿Olvidaste tu contraseña?{" "}
              <a href={`mailto:${supportEmail}`} className="text-primary font-semibold underline">
                Contacta al administrador
              </a>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
