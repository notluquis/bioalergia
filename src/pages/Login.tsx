import { useState } from "react";
import type { ChangeEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/auth-context";
import { useSettings } from "../context/settings-context";
import { logger } from "../lib/logger";
import Button from "../components/Button";
import Input from "../components/Input";
import Alert from "../components/Alert";
import ConnectionIndicator from "../components/ConnectionIndicator";

export default function Login() {
  const { login } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const from = (location.state as { from?: string } | null)?.from ?? "/";

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
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
      setError(message);
      logger.error("[login-page] login error", { email, message });
      console.error("[steps][login] Step error: fallo al iniciar sesión", message);
    } finally {
      console.debug("[steps][login] Step final: reseteando estado de carga");
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center px-6 py-12">
      <div className="absolute inset-x-0 top-0 h-1/3 max-h-[220px] rounded-b-[50%] bg-[radial-gradient(circle_at_top,rgba(14,100,183,0.18),transparent_70%)]" />
      <div className="absolute inset-x-0 bottom-0 h-1/3 max-h-[220px] rounded-t-[55%] bg-[radial-gradient(circle_at_bottom,rgba(241,167,34,0.22),transparent_72%)]" />
      <div className="bg-base-100 relative z-10 w-full max-w-md p-10">
        <div className="mb-6 flex justify-end">
          <ConnectionIndicator />
        </div>
        <div className="flex flex-col items-center gap-3 text-center">
          <img src={settings.logoUrl} alt={settings.orgName} className="max-h-20 object-contain" />
          <h1 className="text-xl font-semibold text-(--brand-primary) drop-shadow-sm">
            Inicia sesión en {settings.orgName}
          </h1>
          <p className="text-sm text-slate-600/90">Usa tu correo corporativo para continuar.</p>
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
          {error && <Alert variant="error">{error}</Alert>}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Ingresando..." : "Ingresar"}
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-600/90">
          ¿Olvidaste tu contraseña? Contacta a <strong>{settings.supportEmail}</strong>
        </p>
      </div>
    </div>
  );
}
