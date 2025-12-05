import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { apiClient } from "@/lib/apiClient";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { Shield, CheckCircle, Smartphone } from "lucide-react";
import { startRegistration } from "@simplewebauthn/browser";

// Helper to detect OS
function getOS() {
  const userAgent = window.navigator.userAgent;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (/iPad|iPhone|iPod/.test(userAgent) && !(window as unknown as any).MSStream) return "iOS";
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const opts = await apiClient.get<any>("/api/auth/passkey/register/options");

      const attResp = await startRegistration(opts);

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
    <div className="min-h-screen bg-base-200 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl surface-elevated rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row">
        {/* Sidebar / Progress */}
        <div className="bg-primary/5 p-8 md:w-1/3 flex flex-col justify-between border-r border-base-300/50">
          <div>
            <h2 className="text-2xl font-bold text-primary mb-6">Bienvenido</h2>
            <div className="space-y-4">
              <div className={`flex items-center gap-3 ${step >= 1 ? "text-primary" : "text-base-content/40"}`}>
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                    step > 1 ? "bg-primary text-white border-primary" : "border-current"
                  }`}
                >
                  {step > 1 ? <CheckCircle size={16} /> : "1"}
                </div>
                <span className="font-medium">Perfil y Clave</span>
              </div>
              <div className={`flex items-center gap-3 ${step >= 2 ? "text-primary" : "text-base-content/40"}`}>
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                    isSecurityComplete ? "bg-primary text-white border-primary" : "border-current"
                  }`}
                >
                  {isSecurityComplete ? <CheckCircle size={16} /> : "2"}
                </div>
                <span className="font-medium">Seguridad</span>
              </div>
            </div>
          </div>
          <div className="text-xs text-base-content/60 mt-8">
            Configuración inicial obligatoria para acceder a la plataforma.
          </div>
        </div>

        {/* Content */}
        <div className="p-8 md:w-2/3 bg-base-100">
          {step === 1 && (
            <form onSubmit={handleProfileSubmit} className="space-y-4 animate-fade-in">
              <h3 className="text-xl font-bold">Completa tu Perfil</h3>
              <p className="text-sm text-base-content/70">
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

              <div className="pt-4 border-t border-base-300">
                <p className="text-sm font-semibold mb-3">Nueva Contraseña</p>
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
            <div className="space-y-6 animate-fade-in">
              <h3 className="text-xl font-bold">Seguridad de Cuenta</h3>
              <p className="text-sm text-base-content/70">
                Para proteger tu cuenta, es <strong>obligatorio</strong> configurar un método de acceso seguro.
              </p>

              {/* Apple Guide */}
              {(os === "macOS" || os === "iOS") && (
                <div className="rounded-xl border border-base-300 bg-base-200/50 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="text-primary" size={20} />
                    <h4 className="font-bold">Recomendado: Apple Passkeys</h4>
                  </div>
                  <p className="text-sm mb-3">
                    Usa Touch ID o Face ID para iniciar sesión sin contraseñas. Se sincroniza con tu Llavero de iCloud.
                  </p>
                  <Button onClick={handleRegisterPasskey} disabled={loading || !!user?.hasPasskey} className="w-full">
                    {user?.hasPasskey ? "Passkey Configurado ✅" : "Configurar Passkey (Touch ID / Face ID)"}
                  </Button>
                </div>
              )}

              {/* Android/Other Guide */}
              {os !== "macOS" && os !== "iOS" && (
                <div className="rounded-xl border border-base-300 bg-base-200/50 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Smartphone className="text-primary" size={20} />
                    <h4 className="font-bold">Recomendado: Google Authenticator</h4>
                  </div>
                  <p className="text-sm mb-3">
                    Descarga Google Authenticator en tu celular para generar códigos de acceso.
                  </p>
                  <div className="flex gap-2 mb-4">
                    <a
                      href="https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2"
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-primary underline"
                    >
                      Play Store
                    </a>
                    <span className="text-xs text-base-content/40">|</span>
                    <a
                      href="https://apps.apple.com/app/google-authenticator/id388497605"
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-primary underline"
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
                    className="w-full mb-2"
                  >
                    {user?.hasPasskey ? "Passkey Configurado ✅" : "Usar Huella / Windows Hello"}
                  </Button>
                  <p className="text-xs text-center text-base-content/60">
                    O ve a Configuración más tarde para activar Google Authenticator.
                  </p>
                </div>
              )}

              <div className="pt-4 border-t border-base-300 flex justify-between items-center">
                <div className="text-xs text-base-content/60">
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
