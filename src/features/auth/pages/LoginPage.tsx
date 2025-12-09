import { useState } from "react";
import type { ChangeEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { startAuthentication } from "@simplewebauthn/browser";
import type { PublicKeyCredentialCreationOptionsJSON } from "@simplewebauthn/types";
import { Fingerprint, Mail } from "lucide-react";
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
      type PasskeyLoginOptions = PublicKeyCredentialCreationOptionsJSON & {
        challenge: string;
      };
      const options = await apiClient.get<PasskeyLoginOptions>("/api/auth/passkey/login/options");

      if (!options.challenge) {
        throw new Error("Error al obtener opciones de biometría");
      }

      const authResp = await startAuthentication({ optionsJSON: options });
      await loginWithPasskey(authResp, options.challenge);

      navigate(from, { replace: true });
    } catch (err) {
      console.error(err);
      setFormError("No se pudo validar el acceso biométrico. Usa tu contraseña.");
      setStep("credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-base-100 flex min-h-screen items-center justify-center px-4 py-10">
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
            <h1 className="text-base-content text-2xl font-semibold">
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
              disabled={loading}
            >
              <Fingerprint className="size-5" />
              Ingresar con biometría
            </Button>

            <button
              type="button"
              onClick={() => {
                setStep("credentials");
                setFormError(null);
              }}
              disabled={loading}
              className="border-base-300 hover:bg-base-200 flex h-12 w-full items-center justify-center gap-2 rounded-lg border transition-colors disabled:opacity-50"
            >
              <Mail className="size-4" />
              <span className="text-sm font-medium">Usar correo y contraseña</span>
            </button>

            <ConnectionIndicator />
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
              required
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

            <ConnectionIndicator />
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
              autoFocus
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

            <ConnectionIndicator />
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
