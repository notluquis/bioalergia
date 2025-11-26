import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { Shield, Key, Check, ArrowRight, User, CreditCard, Smartphone, Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";
import { formatRut, validateRut } from "../../lib/rut";

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
        const res = await fetch("/api/users/profile");
        if (res.ok) {
          const { data } = await res.json();
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
        }
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
      const res = await fetch("/api/auth/mfa/generate", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setMfaSecret(data);
      } else {
        setError("Error al generar MFA");
      }
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
      const res = await fetch("/api/auth/mfa/enable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: mfaCode, secret: mfaSecret?.secret }),
      });
      if (res.ok) {
        setMfaEnabled(true);
        handleNext();
      } else {
        const data = await res.json();
        setError(data.message || "Código incorrecto");
      }
    } catch {
      setError("Error al verificar MFA");
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
      // 1. Save Profile & Password
      const res = await fetch("/api/users/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...profile,
          password,
        }),
      });

      if (!res.ok) throw new Error("Error al guardar datos");

      // 2. Refresh Session & Redirect
      await refreshSession();
      navigate("/");
    } catch {
      setError("Error al finalizar la configuración. Inténtalo de nuevo.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-200 p-4">
      <div className="w-full max-w-2xl bg-base-100 rounded-3xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Progress Bar */}
        <div className="bg-base-200/50 p-4">
          <div className="relative flex justify-between items-center max-w-4xl mx-auto px-4">
            {/* Connecting Line */}
            <div className="absolute top-1/2 left-0 w-full h-0.5 bg-base-300 z-0 -translate-y-1/2" />
            <div
              className="absolute top-1/2 left-0 h-0.5 bg-primary transition-all duration-500 z-0 -translate-y-1/2"
              style={{ width: `${(currentStep / (STEPS.length - 1)) * 100}%` }}
            />

            {STEPS.map((step, idx) => (
              <div key={step.id} className="relative z-10 flex flex-col items-center gap-2 px-1">
                <div
                  className={cn(
                    "w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold transition-all duration-300 border-4",
                    idx <= currentStep
                      ? "bg-primary text-primary-content border-primary shadow-lg shadow-primary/30 scale-110"
                      : "bg-base-100 text-base-content/50 border-base-200"
                  )}
                >
                  {idx < currentStep ? <Check size={14} strokeWidth={3} /> : idx + 1}
                </div>
                <span
                  className={cn(
                    "absolute top-full mt-2 text-[10px] font-medium uppercase tracking-wider transition-colors whitespace-nowrap",
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

        <div className="p-6 sm:p-8 overflow-y-auto flex-1">
          {error && (
            <div className="alert alert-error text-sm py-2 mb-6">
              <span>{error}</span>
            </div>
          )}

          {currentStep === 0 && (
            <div className="text-center space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 py-8">
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto text-primary">
                <Shield size={40} />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-base-content break-all">Hola, {user?.email}</h1>
                <p className="text-base-content/60 mt-2 max-w-md mx-auto">
                  Bienvenido a Finanzas App. Antes de comenzar, necesitamos completar tu perfil y asegurar tu cuenta.
                </p>
              </div>
              <button
                onClick={handleNext}
                className="btn btn-primary btn-lg w-full max-w-xs gap-2 shadow-lg shadow-primary/20"
              >
                Comenzar <ArrowRight size={20} />
              </button>
            </div>
          )}

          {currentStep === 1 && (
            <form
              onSubmit={handleProfileSubmit}
              className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500"
            >
              <div className="text-center mb-6">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto text-primary mb-3">
                  <User size={24} />
                </div>
                <h2 className="text-2xl font-bold">Datos Personales</h2>
                <p className="text-sm text-base-content/60">Información básica para tu perfil.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Nombres</span>
                  </label>
                  <input
                    type="text"
                    className="input input-bordered w-full"
                    value={profile.names}
                    onChange={(e) => setProfile({ ...profile, names: e.target.value })}
                    required
                  />
                </div>
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">RUT</span>
                  </label>
                  <input
                    type="text"
                    className={cn("input input-bordered w-full", error && error.includes("RUT") && "input-error")}
                    value={profile.rut}
                    onChange={(e) => {
                      const val = e.target.value;
                      // Allow typing freely, but maybe restrict chars?
                      // Better to just update state and format on blur or as they type if we want
                      // Let's format as they type but be careful not to block editing
                      // Actually user asked for "formateen automaticamente".
                      // A common pattern is to format on change if it's valid-ish, or just on blur.
                      // Let's try formatting on change but keeping cursor position is hard without a library.
                      // Safest is format on blur or use a controlled input that formats raw input.
                      // For now, let's just update raw value and format on blur, OR format if it looks like a full RUT.
                      // Let's stick to simple: update value, format on blur.
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
                  <label className="label">
                    <span className="label-text">Primer Apellido</span>
                  </label>
                  <input
                    type="text"
                    className="input input-bordered w-full"
                    value={profile.fatherName}
                    onChange={(e) => setProfile({ ...profile, fatherName: e.target.value })}
                  />
                </div>
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Segundo Apellido</span>
                  </label>
                  <input
                    type="text"
                    className="input input-bordered w-full"
                    value={profile.motherName}
                    onChange={(e) => setProfile({ ...profile, motherName: e.target.value })}
                  />
                </div>
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Teléfono</span>
                  </label>
                  <input
                    type="tel"
                    className="input input-bordered w-full"
                    value={profile.phone}
                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                  />
                </div>
                <div className="form-control md:col-span-2">
                  <label className="label">
                    <span className="label-text">Dirección</span>
                  </label>
                  <input
                    type="text"
                    className="input input-bordered w-full"
                    value={profile.address}
                    onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex justify-end mt-6">
                <button type="submit" className="btn btn-primary w-full sm:w-auto px-8">
                  Siguiente
                </button>
              </div>
            </form>
          )}

          {currentStep === 2 && (
            <form
              onSubmit={handleFinancialSubmit}
              className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500"
            >
              <div className="text-center mb-6">
                <div className="w-12 h-12 bg-secondary/10 rounded-full flex items-center justify-center mx-auto text-secondary mb-3">
                  <CreditCard size={24} />
                </div>
                <h2 className="text-2xl font-bold">Datos Bancarios (Opcional)</h2>
                <p className="text-sm text-base-content/60">Para gestionar tus pagos y remuneraciones.</p>
              </div>

              <div className="space-y-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Banco</span>
                  </label>
                  <input
                    type="text"
                    className="input input-bordered w-full"
                    value={profile.bankName}
                    onChange={(e) => setProfile({ ...profile, bankName: e.target.value })}
                    placeholder="Ej: Banco de Chile"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Tipo de Cuenta</span>
                    </label>
                    <select
                      className="select select-bordered w-full"
                      value={profile.bankAccountType}
                      onChange={(e) => setProfile({ ...profile, bankAccountType: e.target.value })}
                    >
                      <option value="">Seleccionar...</option>
                      <option value="Corriente">Cuenta Corriente</option>
                      <option value="Vista">Cuenta Vista / RUT</option>
                      <option value="Ahorro">Cuenta de Ahorro</option>
                    </select>
                  </div>
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Número de Cuenta</span>
                    </label>
                    <input
                      type="text"
                      className="input input-bordered w-full"
                      value={profile.bankAccountNumber}
                      onChange={(e) => setProfile({ ...profile, bankAccountNumber: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button type="button" onClick={() => setCurrentStep((prev) => prev - 1)} className="btn btn-ghost">
                  Atrás
                </button>
                <button type="submit" className="btn btn-primary w-full sm:w-auto px-8">
                  Siguiente
                </button>
              </div>
            </form>
          )}

          {currentStep === 3 && (
            <form
              onSubmit={handlePasswordSubmit}
              className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500"
            >
              <div className="text-center mb-6">
                <div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center mx-auto text-accent mb-3">
                  <Key size={24} />
                </div>
                <h2 className="text-2xl font-bold">Seguridad</h2>
                <p className="text-sm text-base-content/60">Crea una contraseña segura.</p>
              </div>

              <div className="space-y-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Nueva Contraseña</span>
                  </label>
                  <input
                    type="password"
                    className="input input-bordered w-full"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                  />
                </div>
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Confirmar Contraseña</span>
                  </label>
                  <input
                    type="password"
                    className="input input-bordered w-full"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button type="button" onClick={() => setCurrentStep((prev) => prev - 1)} className="btn btn-ghost">
                  Atrás
                </button>
                <button type="submit" className="btn btn-primary w-full sm:w-auto px-8">
                  Siguiente
                </button>
              </div>
            </form>
          )}

          {currentStep === 4 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="text-center mb-6">
                <div className="w-12 h-12 bg-warning/10 rounded-full flex items-center justify-center mx-auto text-warning mb-3">
                  <Smartphone size={24} />
                </div>
                <h2 className="text-2xl font-bold">Configurar MFA</h2>
                <p className="text-sm text-base-content/60">
                  Escanea el código con tu app de autenticación (Google Auth, Authy).
                </p>
              </div>

              {loading && !mfaSecret ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="animate-spin text-primary" size={40} />
                </div>
              ) : mfaSecret ? (
                <div className="flex flex-col items-center gap-6">
                  <div className="bg-white p-4 rounded-xl shadow-sm">
                    <img src={mfaSecret.qrCodeUrl} alt="QR Code" className="w-48 h-48" />
                  </div>

                  <div className="w-full max-w-xs form-control">
                    <label className="label">
                      <span className="label-text text-center w-full">Ingresa el código de 6 dígitos</span>
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      className="input input-bordered text-center text-2xl tracking-widest"
                      value={mfaCode}
                      onChange={(e) => setMfaCode(e.target.value)}
                      placeholder="000000"
                    />
                  </div>

                  <button
                    onClick={verifyMfa}
                    className="btn btn-primary w-full max-w-xs"
                    disabled={mfaCode.length !== 6 || loading}
                  >
                    {loading ? <Loader2 className="animate-spin" /> : "Verificar y Activar"}
                  </button>
                  <button
                    onClick={handleNext}
                    className="btn btn-ghost btn-sm text-base-content/50 hover:text-base-content"
                    disabled={loading}
                  >
                    Omitir por ahora
                  </button>
                </div>
              ) : (
                <div className="text-center text-error">No se pudo cargar el código QR.</div>
              )}
            </div>
          )}

          {currentStep === 5 && (
            <div className="text-center space-y-6 animate-in fade-in zoom-in duration-500 py-8">
              <div className="w-24 h-24 bg-success/10 rounded-full flex items-center justify-center mx-auto text-success">
                <Check size={48} strokeWidth={3} />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-base-content">¡Todo listo!</h1>
                <p className="text-base-content/60 mt-2">Tu perfil ha sido completado y tu cuenta está segura.</p>
              </div>
              <button
                onClick={handleFinalSubmit}
                className="btn btn-primary btn-lg w-full max-w-xs shadow-lg shadow-primary/20"
                disabled={loading}
              >
                {loading ? <Loader2 className="animate-spin" /> : "Finalizar e Ir al Dashboard"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
