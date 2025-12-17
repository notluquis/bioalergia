import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import type { PublicKeyCredentialCreationOptionsJSON } from "@simplewebauthn/browser";
import { useAuth } from "@/context/AuthContext";
import { Shield, Key, Check, ArrowRight, User, CreditCard, Smartphone, Loader2, Fingerprint } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatRut, validateRut } from "@/lib/rut";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { apiClient } from "@/lib/apiClient";

const STEPS = [
  { id: "welcome", title: "Bienvenida" },
  { id: "profile", title: "Datos Personales" },
  { id: "financial", title: "Datos Bancarios" },
  { id: "password", title: "Contraseña" },
  { id: "mfa", title: "MFA" },
  { id: "complete", title: "Listo" },
];

type ProfileData = {
  names: string;
  fatherName: string;
  motherName: string;
  rut: string;
  phone: string;
  address: string;
  bankName: string;
  bankAccountType: string;
  bankAccountNumber: string;
};

export default function OnboardingWizard() {
  const { user, refreshSession } = useAuth();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [profile, setProfile] = useState<ProfileData>({
    names: "",
    fatherName: "",
    motherName: "",
    rut: "",
    phone: "",
    address: "",
    bankName: "",
    bankAccountType: "",
    bankAccountNumber: "",
  });
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // MFA State
  const [mfaSecret, setMfaSecret] = useState<{ secret: string; qrCodeUrl: string } | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaEnabled, setMfaEnabled] = useState(false);

  // Fetch initial profile data
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data } = await apiClient.get<{ data: Partial<ProfileData> }>("/api/users/profile");
        setProfile((prev) => ({
          ...prev,
          names: data.names || "",
          fatherName: data.fatherName || "",
          motherName: data.motherName || "",
          rut: data.rut || "",
          phone: data.phone || "",
          address: data.address || "",
          bankName: data.bankName || "",
          bankAccountType: data.bankAccountType || "",
          bankAccountNumber: data.bankAccountNumber || "",
        }));
      } catch (err) {
        console.error("Error fetching profile", err);
      }
    };
    fetchProfile();
  }, []);

  const handleNext = () => {
    setError(null);
    setCurrentStep((prev) => prev + 1);
  };

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile.names || !profile.rut) {
      setError("Nombres y RUT son obligatorios");
      return;
    }
    if (!validateRut(profile.rut)) {
      setError("El RUT ingresado no es válido");
      return;
    }
    handleNext();
  };

  const handleFinancialSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleNext();
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres");
      return;
    }
    handleNext();
  };

  const generateMfa = async () => {
    setLoading(true);
    try {
      const data = await apiClient.post<{ secret: string; qrCodeUrl: string }>("/api/auth/mfa/setup", {});
      setMfaSecret(data);
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  const verifyMfa = async () => {
    setLoading(true);
    setError(null);
    try {
      await apiClient.post("/api/auth/mfa/enable", { token: mfaCode, secret: mfaSecret?.secret });
      setMfaEnabled(true);
      handleNext();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Código incorrecto");
    } finally {
      setLoading(false);
    }
  };

  const handlePasskeyRegister = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Get options
      const options = await apiClient.get<PublicKeyCredentialCreationOptionsJSON>("/api/auth/passkey/register/options");

      // 2. Create credentials
      const { startRegistration } = await import("@simplewebauthn/browser");
      const attResp = await startRegistration({ optionsJSON: options });

      // 3. Verify
      await apiClient.post("/api/auth/passkey/register/verify", { body: attResp, challenge: options.challenge });

      // Passkey registered successfully
      setMfaEnabled(true); // Treat as enabled so they can skip/next
      handleNext();
    } catch (err) {
      console.error(err);
      setError("No se pudo registrar el Passkey. Intenta nuevamente o usa la App Autenticadora.");
    } finally {
      setLoading(false);
    }
  };

  // Initialize MFA generation when entering step
  useEffect(() => {
    if (currentStep === 4 && !mfaSecret && !mfaEnabled) {
      generateMfa();
    }
  }, [currentStep, mfaSecret, mfaEnabled]);

  const handleFinalSubmit = async () => {
    setLoading(true);
    setError(null);

    try {
      // Logic to prevent surname duplication in 'names' field
      let cleanNames = profile.names.trim();
      if (profile.motherName) {
        const regex = new RegExp(`\\s+${profile.motherName.trim()}$`, "i");
        cleanNames = cleanNames.replace(regex, "");
      }
      if (profile.fatherName) {
        const regex = new RegExp(`\\s+${profile.fatherName.trim()}$`, "i");
        cleanNames = cleanNames.replace(regex, "");
      }
      cleanNames = cleanNames.trim();

      // 1. Save Profile & Password
      await apiClient.post("/api/users/setup", {
        ...profile,
        names: cleanNames,
        password,
      });

      // 2. Refresh Session & Redirect
      await refreshSession();
      navigate("/");
    } catch {
      setError("Error al finalizar la configuración. Inténtalo de nuevo.");
      setLoading(false);
    }
  };

  return (
    <div className="bg-base-200 flex min-h-screen items-center justify-center p-4">
      <div className="bg-base-100 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl shadow-xl">
        {/* Progress Bar */}
        <div className="mb-4 p-4">
          <div className="relative mx-auto flex max-w-4xl items-center justify-between px-4">
            {/* Connecting Line */}
            <div className="bg-base-300 absolute top-1/2 left-0 z-0 h-0.5 w-full -translate-y-1/2" />
            <div
              className="bg-primary absolute top-1/2 left-0 z-0 h-0.5 -translate-y-1/2 transition-all duration-500"
              style={{ width: `${(currentStep / (STEPS.length - 1)) * 100}%` }}
            />

            {STEPS.map((step, idx) => (
              <div key={step.id} className="relative z-10 flex flex-col items-center gap-2 px-1">
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full border-4 text-xs font-bold transition-all duration-300 sm:h-10 sm:w-10 sm:text-sm",
                    idx <= currentStep
                      ? "bg-primary text-primary-content border-primary shadow-primary/30 scale-110 shadow-lg"
                      : "bg-base-100 text-base-content/50 border-base-200"
                  )}
                >
                  {idx < currentStep ? <Check size={14} strokeWidth={3} /> : idx + 1}
                </div>
                <span
                  className={cn(
                    "absolute top-full mt-2 text-[10px] font-medium tracking-wider whitespace-nowrap uppercase transition-colors",
                    idx <= currentStep ? "text-primary" : "text-base-content/60",
                    // Show all labels on sm+ screens, smart hiding on very small screens
                    "hidden sm:block",
                    // Always show current step label even on mobile
                    idx === currentStep && "block",
                    // Center the text
                    "left-1/2 -translate-x-1/2"
                  )}
                >
                  {step.title}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 sm:p-8">
          {error && (
            <div className="alert alert-error mb-6 py-2 text-sm">
              <span>{error}</span>
            </div>
          )}

          {currentStep === 0 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 space-y-6 py-8 text-center duration-500">
              <div className="bg-primary/10 text-primary mx-auto flex h-20 w-20 items-center justify-center rounded-full">
                <Shield size={40} />
              </div>
              <div>
                <h1 className="text-base-content text-2xl font-bold break-all sm:text-3xl">Hola, {user?.email}</h1>
                <p className="text-base-content/60 mx-auto mt-2 max-w-md">
                  Bienvenido a la intranet de Bioalergia. Antes de comenzar, necesitamos completar tu perfil y asegurar
                  tu cuenta.
                </p>
              </div>
              <Button
                onClick={handleNext}
                variant="primary"
                size="lg"
                className="shadow-primary/20 w-full max-w-xs gap-2 shadow-lg"
              >
                Comenzar <ArrowRight size={20} />
              </Button>
            </div>
          )}

          {currentStep === 1 && (
            <form
              onSubmit={handleProfileSubmit}
              className="animate-in fade-in slide-in-from-right-4 space-y-6 duration-500"
            >
              <div className="mb-6 text-center">
                <div className="bg-primary/10 text-primary mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full">
                  <User size={24} />
                </div>
                <h2 className="text-2xl font-bold">Datos Personales</h2>
                <p className="text-base-content/60 text-sm">Información básica para tu perfil.</p>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="form-control">
                  <Input
                    label="Nombres (Sin Apellidos)"
                    value={profile.names}
                    onChange={(e) => setProfile({ ...profile, names: e.target.value })}
                    required
                  />
                </div>
                <div className="form-control">
                  <Input
                    label="RUT"
                    value={profile.rut}
                    error={error && error.includes("RUT") ? "RUT inválido" : undefined}
                    onChange={(e) => {
                      const val = e.target.value;
                      setProfile({ ...profile, rut: val });
                    }}
                    onBlur={() => {
                      const formatted = formatRut(profile.rut);
                      setProfile({ ...profile, rut: formatted });
                      if (formatted && !validateRut(formatted)) {
                        setError("RUT inválido");
                      } else {
                        setError(null);
                      }
                    }}
                    required
                    placeholder="12.345.678-9"
                  />
                </div>
                <div className="form-control">
                  <Input
                    label="Primer Apellido"
                    value={profile.fatherName}
                    onChange={(e) => setProfile({ ...profile, fatherName: e.target.value })}
                  />
                </div>
                <div className="form-control">
                  <Input
                    label="Segundo Apellido"
                    value={profile.motherName}
                    onChange={(e) => setProfile({ ...profile, motherName: e.target.value })}
                  />
                </div>
                <div className="form-control">
                  <Input
                    label="Teléfono"
                    type="tel"
                    value={profile.phone}
                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                  />
                </div>
                <div className="form-control md:col-span-2">
                  <Input
                    label="Dirección"
                    value={profile.address}
                    onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <Button type="submit" variant="primary" className="w-full px-8 sm:w-auto">
                  Siguiente
                </Button>
              </div>
            </form>
          )}

          {currentStep === 2 && (
            <form
              onSubmit={handleFinancialSubmit}
              className="animate-in fade-in slide-in-from-right-4 space-y-6 duration-500"
            >
              <div className="mb-6 text-center">
                <div className="bg-secondary/10 text-secondary mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full">
                  <CreditCard size={24} />
                </div>
                <h2 className="text-2xl font-bold">Datos Bancarios</h2>
                <p className="text-base-content/60 text-sm">Para gestionar tus pagos y remuneraciones.</p>
              </div>

              <div className="space-y-4">
                <div className="form-control">
                  <Input
                    label="Banco"
                    value={profile.bankName}
                    onChange={(e) => setProfile({ ...profile, bankName: e.target.value })}
                    placeholder="Ej: Banco de Chile"
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="form-control">
                    <Input
                      as="select"
                      label="Tipo de Cuenta"
                      value={profile.bankAccountType}
                      onChange={(e) => setProfile({ ...profile, bankAccountType: e.target.value })}
                    >
                      <option value="">Seleccionar...</option>
                      <option value="Corriente">Cuenta Corriente</option>
                      <option value="Vista">Cuenta Vista / RUT</option>
                      <option value="Ahorro">Cuenta de Ahorro</option>
                    </Input>
                  </div>
                  <div className="form-control">
                    <Input
                      label="Número de Cuenta"
                      value={profile.bankAccountNumber}
                      onChange={(e) => setProfile({ ...profile, bankAccountNumber: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <Button type="button" onClick={() => setCurrentStep((prev) => prev - 1)} variant="ghost">
                  Atrás
                </Button>
                <Button type="submit" variant="primary" className="w-full px-8 sm:w-auto">
                  Siguiente
                </Button>
              </div>
            </form>
          )}

          {currentStep === 3 && (
            <form
              onSubmit={handlePasswordSubmit}
              className="animate-in fade-in slide-in-from-right-4 space-y-6 duration-500"
            >
              <div className="mb-6 text-center">
                <div className="bg-accent/10 text-accent mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full">
                  <Key size={24} />
                </div>
                <h2 className="text-2xl font-bold">Seguridad</h2>
                <p className="text-base-content/60 text-sm">Crea una contraseña segura.</p>
              </div>

              <div className="space-y-4">
                <div className="form-control">
                  <Input
                    label="Nueva Contraseña"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                  />
                </div>
                <div className="form-control">
                  <Input
                    label="Confirmar Contraseña"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <Button type="button" onClick={() => setCurrentStep((prev) => prev - 1)} variant="ghost">
                  Atrás
                </Button>
                <Button type="submit" variant="primary" className="w-full px-8 sm:w-auto">
                  Siguiente
                </Button>
              </div>
            </form>
          )}

          {currentStep === 4 && (
            <div className="animate-in fade-in slide-in-from-right-4 space-y-6 duration-500">
              <div className="mb-6 text-center">
                <div className="bg-warning/10 text-warning mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full">
                  <Smartphone size={24} />
                </div>
                <h2 className="text-2xl font-bold">Configurar MFA</h2>
                <p className="text-base-content/60 text-sm">
                  Escanea el código con tu app de autenticación (Google Authenticator, Microsoft Authenticator, Apple
                  Passwords, etc).
                </p>
              </div>

              {loading && !mfaSecret ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="text-primary animate-spin" size={40} />
                </div>
              ) : mfaSecret ? (
                <div className="flex flex-col items-center gap-6">
                  <div className="rounded-xl bg-white p-4 shadow-sm">
                    <img
                      src={mfaSecret.qrCodeUrl}
                      alt="QR Code"
                      className="h-48 w-48"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>

                  <div className="form-control w-full max-w-xs">
                    <Input
                      label="Ingresa el código de 6 dígitos"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      className="text-center text-2xl tracking-widest"
                      value={mfaCode}
                      onChange={(e) => setMfaCode(e.target.value)}
                      placeholder="000000"
                    />
                  </div>

                  <Button
                    onClick={verifyMfa}
                    variant="primary"
                    className="w-full max-w-xs"
                    disabled={mfaCode.length !== 6 || loading}
                  >
                    {loading ? <Loader2 className="animate-spin" /> : "Verificar y Activar"}
                  </Button>

                  <div className="divider text-base-content/40 text-xs">O usa biometría</div>

                  <Button
                    onClick={handlePasskeyRegister}
                    variant="outline"
                    className="w-full max-w-xs gap-2"
                    disabled={loading}
                  >
                    <Fingerprint size={20} />
                    Registrar Passkey (Huella/FaceID)
                  </Button>

                  <Button
                    onClick={handleNext}
                    variant="ghost"
                    size="sm"
                    className="text-base-content/50 hover:text-base-content mt-2"
                    disabled={loading}
                  >
                    Omitir por ahora
                  </Button>
                </div>
              ) : (
                <div className="text-error text-center">No se pudo cargar el código QR.</div>
              )}
            </div>
          )}

          {currentStep === 5 && (
            <div className="animate-in fade-in zoom-in space-y-6 py-8 text-center duration-500">
              <div className="bg-success/10 text-success mx-auto flex h-24 w-24 items-center justify-center rounded-full">
                <Check size={48} strokeWidth={3} />
              </div>
              <div>
                <h1 className="text-base-content text-3xl font-bold">¡Todo listo!</h1>
                <p className="text-base-content/60 mt-2">Tu perfil ha sido completado y tu cuenta está segura.</p>
              </div>
              <Button
                onClick={handleFinalSubmit}
                variant="primary"
                size="lg"
                className="shadow-primary/20 w-full max-w-xs shadow-lg"
                disabled={loading}
              >
                {loading ? <Loader2 className="animate-spin" /> : "Finalizar e Ir al Dashboard"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
