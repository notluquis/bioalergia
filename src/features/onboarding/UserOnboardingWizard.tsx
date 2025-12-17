import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { apiClient } from "@/lib/apiClient";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { Shield, CheckCircle, Smartphone } from "lucide-react";
import { startRegistration } from "@simplewebauthn/browser";

// Derive type directly from the function that consumes it to avoid import issues
type PublicKeyCredentialCreationOptionsJSON = Parameters<typeof startRegistration>[0]["optionsJSON"];

declare global {
  interface Window {
    MSStream?: unknown;
  }
}

// Helper to detect OS
function getOS() {
  const userAgent = window.navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream) return "iOS";
  if (/Macintosh/.test(userAgent)) return "macOS";
  if (/Android/.test(userAgent)) return "Android";
  return "Other";
}

export default function UserOnboardingWizard() {
  const { user, refreshSession } = useAuth();
  const navigate = useNavigate();
  const { success, error } = useToast();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const os = getOS();

  // Profile Form State
  const [profile, setProfile] = useState({
    names: "",
    fatherName: "",
    motherName: "",
    rut: "",
    phone: "",
    address: "",
    password: "",
    confirmPassword: "",
  });

  // Load initial data
  useEffect(() => {
    if (user?.status === "ACTIVE") {
      // If already active, maybe redirect? Or allow editing?
      // For now, assume this is only for PENDING_SETUP
    }
  }, [user]);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (profile.password !== profile.confirmPassword) {
      error("Las contraseñas no coinciden");
      return;
    }
    setLoading(true);
    try {
      await apiClient.post("/api/users/setup", profile);
      await refreshSession();
      setStep(2);
      success("Perfil actualizado");
    } catch (err) {
      error(err instanceof Error ? err.message : "Error al actualizar perfil");
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterPasskey = async () => {
    setLoading(true);
    try {
      const opts = await apiClient.get<PublicKeyCredentialCreationOptionsJSON>("/api/auth/passkey/register/options");

      const attResp = await startRegistration({ optionsJSON: opts });

      await apiClient.post("/api/auth/passkey/register/verify", { body: attResp, challenge: opts.challenge });

      success("Passkey registrado exitosamente");
      await refreshSession();
    } catch (err) {
      console.error(err);
      error("Error al registrar Passkey. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = () => {
    if (user?.mfaEnforced && !user.hasPasskey && !user.mfaEnabled) {
      error("Debes configurar Passkey o MFA para continuar");
      return;
    }
    navigate("/");
  };

  const isSecurityComplete = user?.hasPasskey || user?.mfaEnabled;

  return (
    <div className="bg-base-200 flex min-h-screen items-center justify-center p-4">
      <div className="surface-elevated flex w-full max-w-3xl flex-col overflow-hidden rounded-3xl shadow-2xl md:flex-row">
        {/* Sidebar / Progress */}
        <div className="bg-primary/5 border-base-300/50 flex flex-col justify-between border-r p-8 md:w-1/3">
          <div>
            <h2 className="text-primary mb-6 text-2xl font-bold">Bienvenido</h2>
            <div className="space-y-4">
              <div className={`flex items-center gap-3 ${step >= 1 ? "text-primary" : "text-base-content/60"}`}>
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full border-2 ${
                    step > 1 ? "bg-primary border-primary text-white" : "border-current"
                  }`}
                >
                  {step > 1 ? <CheckCircle size={16} /> : "1"}
                </div>
                <span className="font-medium">Perfil y Clave</span>
              </div>
              <div className={`flex items-center gap-3 ${step >= 2 ? "text-primary" : "text-base-content/40"}`}>
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full border-2 ${
                    isSecurityComplete ? "bg-primary border-primary text-white" : "border-current"
                  }`}
                >
                  {isSecurityComplete ? <CheckCircle size={16} /> : "2"}
                </div>
                <span className="font-medium">Seguridad</span>
              </div>
            </div>
          </div>
          <div className="text-base-content/70 mt-8 text-xs">
            Configuración inicial obligatoria para acceder a la plataforma.
          </div>
        </div>

        {/* Content */}
        <div className="bg-base-100 p-8 md:w-2/3">
          {step === 1 && (
            <form onSubmit={handleProfileSubmit} className="animate-fade-in space-y-4">
              <h3 className="text-xl font-bold">Completa tu Perfil</h3>
              <p className="text-base-content/70 text-sm">
                Necesitamos algunos datos básicos y que definas tu contraseña personal.
              </p>

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Nombres"
                  value={profile.names}
                  onChange={(e) => setProfile({ ...profile, names: e.target.value })}
                  required
                />
                <Input
                  label="RUT"
                  value={profile.rut}
                  onChange={(e) => setProfile({ ...profile, rut: e.target.value })}
                  required
                />
                <Input
                  label="Apellido Paterno"
                  value={profile.fatherName}
                  onChange={(e) => setProfile({ ...profile, fatherName: e.target.value })}
                />
                <Input
                  label="Apellido Materno"
                  value={profile.motherName}
                  onChange={(e) => setProfile({ ...profile, motherName: e.target.value })}
                />
              </div>
              <Input
                label="Teléfono"
                value={profile.phone}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
              />

              <div className="border-base-300 border-t pt-4">
                <p className="mb-3 text-sm font-semibold">Nueva Contraseña</p>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Contraseña"
                    type="password"
                    value={profile.password}
                    onChange={(e) => setProfile({ ...profile, password: e.target.value })}
                    required
                    minLength={8}
                  />
                  <Input
                    label="Confirmar"
                    type="password"
                    value={profile.confirmPassword}
                    onChange={(e) => setProfile({ ...profile, confirmPassword: e.target.value })}
                    required
                    minLength={8}
                  />
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <Button type="submit" disabled={loading}>
                  {loading ? "Guardando..." : "Continuar"}
                </Button>
              </div>
            </form>
          )}

          {step === 2 && (
            <div className="animate-fade-in space-y-6">
              <h3 className="text-xl font-bold">Seguridad de Cuenta</h3>
              <p className="text-base-content/70 text-sm">
                Para proteger tu cuenta, es <strong>obligatorio</strong> configurar un método de acceso seguro.
              </p>

              {/* Apple Guide */}
              {(os === "macOS" || os === "iOS") && (
                <div className="border-base-300 bg-base-200/50 rounded-xl border p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <Shield className="text-primary" size={20} />
                    <h4 className="font-bold">Recomendado: Apple Passkeys</h4>
                  </div>
                  <p className="mb-3 text-sm">
                    Usa Touch ID o Face ID para iniciar sesión sin contraseñas. Se sincroniza con tu Llavero de iCloud.
                  </p>
                  <Button onClick={handleRegisterPasskey} disabled={loading || !!user?.hasPasskey} className="w-full">
                    {user?.hasPasskey ? "Passkey Configurado ✅" : "Configurar Passkey (Touch ID / Face ID)"}
                  </Button>
                </div>
              )}

              {/* Android/Other Guide */}
              {os !== "macOS" && os !== "iOS" && (
                <div className="border-base-300 bg-base-200/50 rounded-xl border p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <Smartphone className="text-primary" size={20} />
                    <h4 className="font-bold">Recomendado: Google Authenticator</h4>
                  </div>
                  <p className="mb-3 text-sm">
                    Descarga Google Authenticator en tu celular para generar códigos de acceso.
                  </p>
                  <div className="mb-4 flex gap-2">
                    <a
                      href="https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2"
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary text-xs underline"
                    >
                      Play Store
                    </a>
                    <span className="text-base-content/40 text-xs">|</span>
                    <a
                      href="https://apps.apple.com/app/google-authenticator/id388497605"
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary text-xs underline"
                    >
                      App Store
                    </a>
                  </div>
                  {/* We need a way to trigger MFA setup here. For now, redirect to security settings? 
                      Or embed MFA setup? Let's assume we can redirect or show a modal. 
                      For simplicity in this wizard, we'll encourage Passkey first as it's easier. */}
                  <Button
                    onClick={handleRegisterPasskey}
                    disabled={loading || !!user?.hasPasskey}
                    className="mb-2 w-full"
                  >
                    {user?.hasPasskey ? "Passkey Configurado ✅" : "Usar Huella / Windows Hello"}
                  </Button>
                  <p className="text-base-content/70 text-center text-xs">
                    O ve a Configuración más tarde para activar Google Authenticator.
                  </p>
                </div>
              )}

              <div className="border-base-300 flex items-center justify-between border-t pt-4">
                <div className="text-base-content/80 text-xs">
                  Estado:{" "}
                  <span className={isSecurityComplete ? "text-success font-bold" : "text-warning font-bold"}>
                    {isSecurityComplete ? "Seguro" : "Pendiente"}
                  </span>
                </div>
                <Button onClick={handleFinish} disabled={!isSecurityComplete && (user?.mfaEnforced ?? true)}>
                  Finalizar
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
