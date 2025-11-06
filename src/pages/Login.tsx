import { useState } from "react";
import type { ChangeEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSettings } from "../context/SettingsContext";
import { logger } from "../lib/logger";
import Button from "../components/Button";
import Input from "../components/Input";
import ConnectionIndicator from "../components/ConnectionIndicator";
import { useToast } from "../context/ToastContext";

export default function Login() {
  const { login } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const location = useLocation();
  const { error: toastError } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const from = (location.state as { from?: string } | null)?.from ?? "/";

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    try {
      const timeoutSeconds = Number(import.meta.env?.VITE_AUTH_TIMEOUT ?? 8);
      console.debug("[steps][login] Step 1: preparando envío de credenciales", email);
      logger.info("[login-page] envío credenciales", { email });
      console.debug("[steps][login] Step 2: llamando login()", email);
      console.debug("[steps][login] Timeout configurado", { timeoutSeconds });
      await login(email, password);
      logger.info("[login-page] login OK", { email });
      console.debug("[steps][login] Step 3: login() resuelto, navegando", from);
      navigate(from, { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo iniciar sesión";
      toastError(message);
      logger.error("[login-page] login error", { email, message });
      console.error("[steps][login] Step error: fallo al iniciar sesión", message);
    } finally {
      console.debug("[steps][login] Step final: reseteando estado de carga");
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-base-200/60 via-base-100 to-base-100 px-6 py-12">
      <div className="surface-elevated relative z-10 w-full max-w-md px-10 py-12">
        <div className="mb-6 flex justify-end">
          <ConnectionIndicator />
        </div>
        <div className="flex flex-col items-center gap-3 text-center">
          <img src={settings.logoUrl} alt={settings.orgName} className="brand-logo" />
          <h1 className="text-xl font-semibold text-primary drop-shadow-sm">Inicia sesión en {settings.orgName}</h1>
          <p className="text-sm text-base-content/90">Usa tu correo corporativo para continuar.</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <Input
            label="Correo electrónico"
            type="email"
            value={email}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setEmail(event.target.value)}
            placeholder="usuario@bioalergia.cl"
            autoComplete="email"
            required
          />
          <Input
            label="Contraseña"
            type="password"
            value={password}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setPassword(event.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            required
          />
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Ingresando..." : "Ingresar"}
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-base-content/90">
          ¿Olvidaste tu contraseña? Contacta a <strong>{settings.supportEmail}</strong>
        </p>
      </div>
    </div>
  );
}
