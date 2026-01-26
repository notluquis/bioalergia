import { Separator } from "@heroui/react";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  Check,
  CreditCard,
  Fingerprint,
  Key,
  Loader2,
  Shield,
  Smartphone,
  User,
} from "lucide-react";
import { useEffect, useState } from "react";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

import { useAuth } from "@/context/AuthContext";
import {
  enableMfa,
  fetchPasskeyRegistrationOptions,
  setupMfa,
  verifyPasskeyRegistration,
} from "@/features/auth/api";
import { fetchUserProfile, setupUser } from "@/features/users/api";
import { formatRut, validateRut } from "@/lib/rut";
import { cn } from "@/lib/utils";

const STEPS = [
  { id: "welcome", title: "Bienvenida" },
  { id: "profile", title: "Datos personales" },
  { id: "financial", title: "Datos bancarios" },
  { id: "password", title: "Contraseña" },
  { id: "mfa", title: "MFA" },
  { id: "complete", title: "Listo" },
];

interface ProfileData {
  address: string;
  bankAccountNumber: string;
  bankAccountType: string;
  bankName: string;
  fatherName: string;
  motherName: string;
  names: string;
  phone: string;
  rut: string;
}

export default function OnboardingWizard() {
  const { refreshSession, user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [error, setError] = useState<null | string>(null);

  // Security: Redirect if user already completed onboarding
  useEffect(() => {
    if (user && user.status !== "PENDING_SETUP") {
      void navigate({ replace: true, to: "/" });
    }
  }, [user, navigate]);

  // Queries
  const { data: profileData } = useSuspenseQuery({
    queryFn: fetchUserProfile,
    queryKey: ["user-profile"],
    refetchOnWindowFocus: false,
  });

  // Form State
  const [profile, setProfile] = useState<ProfileData>(() => ({
    address: profileData.address ?? "",
    bankAccountNumber: profileData.bankAccountNumber ?? "",
    bankAccountType: profileData.bankAccountType ?? "",
    bankName: profileData.bankName ?? "",
    fatherName: profileData.fatherName,
    motherName: profileData.motherName ?? "",
    names: profileData.names,
    phone: profileData.phone ?? "",
    rut: profileData.rut,
  }));

  const [mfaCode, setMfaCode] = useState("");
  const [mfaSecret, setMfaSecret] = useState<null | { qrCodeUrl: string; secret: string }>(null);
  const [mfaEnabled, setMfaEnabled] = useState(false);

  // Password state
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Mutations
  const mfaSetupMutation = useMutation({
    mutationFn: () =>
      setupMfa().then((res) => {
        if (res.status !== "ok")
          throw new Error(res.message ?? "Error al iniciar configuración MFA");
        return res;
      }),
    onError: () => {
      setError("Error de conexión");
    },
    onSuccess: (data) => {
      setMfaSecret({ qrCodeUrl: data.qrCodeUrl, secret: data.secret });
    },
  });

  const mfaVerifyMutation = useMutation({
    mutationFn: (token: string) =>
      enableMfa({ secret: mfaSecret?.secret, token }).then((res) => {
        if (res.status !== "ok") throw new Error(res.message ?? "Código incorrecto");
        return res;
      }),
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Código incorrecto");
    },
    onSuccess: () => {
      setMfaEnabled(true);
      handleNext();
    },
  });

  const passkeyRegisterMutation = useMutation({
    mutationFn: async () => {
      const options = await fetchPasskeyRegistrationOptions();
      if (options.status === "error") throw new Error(options.message);

      const { startRegistration } = await import("@simplewebauthn/browser");
      const attResp = await startRegistration({ optionsJSON: options });

      const verifyData = await verifyPasskeyRegistration({
        body: attResp,
        challenge: options.challenge,
      });
      if (verifyData.status !== "ok")
        throw new Error(verifyData.message ?? "Error al verificar passkey");
    },
    onError: (err) => {
      console.error(err);
      setError("No se pudo registrar el Passkey. Intenta nuevamente o usa la App Autenticadora.");
    },
    onSuccess: () => {
      setMfaEnabled(true);
      handleNext();
    },
  });

  const finalSubmitMutation = useMutation({
    mutationFn: async () => {
      // Logic to prevent surname duplication in 'names' field
      let cleanNames = profile.names.trim();
      if (profile.motherName) {
        const regex = new RegExp(String.raw`\s+${profile.motherName.trim()}$`, "i");
        cleanNames = cleanNames.replace(regex, "");
      }
      if (profile.fatherName) {
        const regex = new RegExp(String.raw`\s+${profile.fatherName.trim()}$`, "i");
        cleanNames = cleanNames.replace(regex, "");
      }
      cleanNames = cleanNames.trim();

      await setupUser({
        ...profile,
        names: cleanNames,
        password,
      });

      // Force invalidation of auth session to ensure we get fresh data
      await queryClient.invalidateQueries({ queryKey: ["auth", "session"] });

      // Attempt to refresh session context
      try {
        await refreshSession();
      } catch (e) {
        console.error("Session refresh failed after setup:", e);
        // Continue anyway, as the backend setup likely succeeded
      }
    },
    onError: (err) => {
      console.error("Onboarding setup failed:", err);
      // Detailed error for better UX
      const msg = err instanceof Error ? err.message : "Error desconocido";
      setError(
        msg || "Error al finalizar la configuración. Verifica tu conexión e inténtalo de nuevo.",
      );
    },
    onSuccess: () => {
      // Force hard redirect to ensure layout re-evaluation
      void navigate({ to: "/", replace: true });
    },
  });

  const loading =
    mfaSetupMutation.isPending ||
    mfaVerifyMutation.isPending ||
    passkeyRegisterMutation.isPending ||
    finalSubmitMutation.isPending;

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

  const verifyMfa = () => {
    mfaVerifyMutation.mutate(mfaCode);
  };
  const handlePasskeyRegister = () => {
    passkeyRegisterMutation.mutate();
  };

  const { mutate: triggerSetupMfa } = mfaSetupMutation;

  // Initialize MFA generation when entering step
  useEffect(() => {
    if (currentStep === 4 && !mfaSecret && !mfaEnabled) {
      triggerSetupMfa();
    }
  }, [currentStep, mfaSecret, mfaEnabled, triggerSetupMfa]);

  const handleFinalSubmit = () => {
    finalSubmitMutation.mutate();
  };

  return (
    <div className="bg-default-50 flex min-h-screen items-center justify-center p-4">
      <div className="bg-background flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl shadow-xl">
        {/* Progress Bar */}
        <div className="mb-4 p-4">
          <div className="relative mx-auto flex max-w-4xl items-center justify-between px-4">
            {/* Connecting Line */}
            <div className="bg-default-100 absolute top-1/2 left-0 z-0 h-0.5 w-full -translate-y-1/2" />
            <div
              className="bg-primary absolute top-1/2 left-0 z-0 h-0.5 -translate-y-1/2 transition-all duration-500"
              style={{ width: `${(currentStep / (STEPS.length - 1)) * 100}%` }}
            />

            {STEPS.map((step, idx) => (
              <div className="relative z-10 flex flex-col items-center gap-2 px-1" key={step.id}>
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full border-4 text-xs font-bold transition-all duration-300 sm:h-10 sm:w-10 sm:text-sm",
                    idx <= currentStep
                      ? "bg-primary text-primary-foreground border-primary shadow-primary/30 scale-110 shadow-lg"
                      : "bg-background text-default-400 border-default-100",
                  )}
                >
                  {idx < currentStep ? <Check size={14} strokeWidth={3} /> : idx + 1}
                </div>
                <span
                  className={cn(
                    "absolute top-full mt-2 text-[10px] font-medium tracking-wider whitespace-nowrap uppercase transition-colors",
                    idx <= currentStep ? "text-primary" : "text-default-500",
                    // Show all labels on sm+ screens, smart hiding on very small screens
                    "hidden sm:block",
                    // Always show current step label even on mobile
                    idx === currentStep && "block",
                    // Center the text
                    "left-1/2 -translate-x-1/2",
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
            <Alert variant="error" className="mb-6">
              <span>{error}</span>
            </Alert>
          )}

          {currentStep === 0 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 space-y-6 py-8 text-center duration-500">
              <div className="bg-primary/10 text-primary mx-auto flex h-20 w-20 items-center justify-center rounded-full">
                <Shield size={40} />
              </div>
              <div>
                <h1 className="text-foreground text-2xl font-bold break-all sm:text-3xl">
                  Hola, {user?.email}
                </h1>
                <p className="text-default-500 mx-auto mt-2 max-w-md">
                  Bienvenido a la intranet de Bioalergia. Antes de comenzar, necesitamos completar
                  tu perfil y asegurar tu cuenta.
                </p>
              </div>
              <Button
                className="shadow-primary/20 w-full max-w-xs gap-2 shadow-lg"
                onClick={handleNext}
                size="lg"
                variant="primary"
              >
                Comenzar <ArrowRight size={20} />
              </Button>
            </div>
          )}

          {currentStep === 1 && (
            <form
              className="animate-in fade-in slide-in-from-right-4 space-y-6 duration-500"
              onSubmit={handleProfileSubmit}
            >
              <div className="mb-6 text-center">
                <div className="bg-primary/10 text-primary mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full">
                  <User size={24} />
                </div>
                <h2 className="text-2xl font-bold">Datos personales</h2>
                <p className="text-default-500 text-sm">Información básica para tu perfil.</p>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="form-control">
                  <Input
                    label="Nombres (sin apellidos)"
                    onChange={(e) => {
                      setProfile({ ...profile, names: e.target.value });
                    }}
                    required
                    value={profile.names}
                  />
                </div>
                <div className="form-control">
                  <Input
                    error={error?.includes("RUT") ? "RUT inválido" : undefined}
                    label="RUT"
                    onBlur={() => {
                      const formatted = formatRut(profile.rut);
                      setProfile({ ...profile, rut: formatted });
                      if (formatted && !validateRut(formatted)) {
                        setError("RUT inválido");
                      } else {
                        setError(null);
                      }
                    }}
                    onChange={(e) => {
                      const val = e.target.value;
                      setProfile({ ...profile, rut: val });
                    }}
                    placeholder="12.345.678-9"
                    required
                    value={profile.rut}
                  />
                </div>
                <div className="form-control">
                  <Input
                    label="Primer apellido"
                    onChange={(e) => {
                      setProfile({ ...profile, fatherName: e.target.value });
                    }}
                    value={profile.fatherName}
                  />
                </div>
                <div className="form-control">
                  <Input
                    label="Segundo apellido"
                    onChange={(e) => {
                      setProfile({ ...profile, motherName: e.target.value });
                    }}
                    value={profile.motherName}
                  />
                </div>
                <div className="form-control">
                  <Input
                    label="Teléfono"
                    onChange={(e) => {
                      setProfile({ ...profile, phone: e.target.value });
                    }}
                    type="tel"
                    value={profile.phone}
                  />
                </div>
                <div className="form-control md:col-span-2">
                  <Input
                    label="Dirección"
                    onChange={(e) => {
                      setProfile({ ...profile, address: e.target.value });
                    }}
                    value={profile.address}
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <Button className="w-full px-8 sm:w-auto" type="submit" variant="primary">
                  Siguiente
                </Button>
              </div>
            </form>
          )}

          {currentStep === 2 && (
            <form
              className="animate-in fade-in slide-in-from-right-4 space-y-6 duration-500"
              onSubmit={handleFinancialSubmit}
            >
              <div className="mb-6 text-center">
                <div className="bg-secondary/10 text-secondary mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full">
                  <CreditCard size={24} />
                </div>
                <h2 className="text-2xl font-bold">Datos bancarios</h2>
                <p className="text-default-500 text-sm">
                  Para gestionar tus pagos y remuneraciones.
                </p>
              </div>

              <div className="space-y-4">
                <div className="form-control">
                  <Input
                    label="Banco"
                    onChange={(e) => {
                      setProfile({ ...profile, bankName: e.target.value });
                    }}
                    placeholder="Ej: Banco de Chile"
                    value={profile.bankName}
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="form-control">
                    <Input
                      as="select"
                      label="Tipo de cuenta"
                      onChange={(e) => {
                        setProfile({ ...profile, bankAccountType: e.target.value });
                      }}
                      value={profile.bankAccountType}
                    >
                      <option value="">Seleccionar...</option>
                      <option value="Corriente">Cuenta corriente</option>
                      <option value="Vista">Cuenta vista / RUT</option>
                      <option value="Ahorro">Cuenta de ahorro</option>
                    </Input>
                  </div>
                  <div className="form-control">
                    <Input
                      label="Número de cuenta"
                      onChange={(e) => {
                        setProfile({ ...profile, bankAccountNumber: e.target.value });
                      }}
                      value={profile.bankAccountNumber}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <Button
                  onClick={() => {
                    setCurrentStep((prev) => prev - 1);
                  }}
                  type="button"
                  variant="ghost"
                >
                  Atrás
                </Button>
                <Button className="w-full px-8 sm:w-auto" type="submit" variant="primary">
                  Siguiente
                </Button>
              </div>
            </form>
          )}

          {currentStep === 3 && (
            <form
              className="animate-in fade-in slide-in-from-right-4 space-y-6 duration-500"
              onSubmit={handlePasswordSubmit}
            >
              <div className="mb-6 text-center">
                <div className="bg-secondary/10 text-secondary mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full">
                  <Key size={24} />
                </div>
                <h2 className="text-2xl font-bold">Seguridad</h2>
                <p className="text-default-500 text-sm">Crea una contraseña segura.</p>
              </div>

              <div className="space-y-4">
                <div className="form-control">
                  <Input
                    label="Nueva contraseña"
                    minLength={8}
                    onChange={(e) => {
                      setPassword(e.target.value);
                    }}
                    required
                    type="password"
                    value={password}
                  />
                </div>
                <div className="form-control">
                  <Input
                    label="Confirmar contraseña"
                    minLength={8}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                    }}
                    required
                    type="password"
                    value={confirmPassword}
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <Button
                  onClick={() => {
                    setCurrentStep((prev) => prev - 1);
                  }}
                  type="button"
                  variant="ghost"
                >
                  Atrás
                </Button>
                <Button className="w-full px-8 sm:w-auto" type="submit" variant="primary">
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
                <p className="text-default-500 text-sm">
                  Escanea el código con tu app de autenticación (Google Authenticator, Microsoft
                  Authenticator, Apple Passwords, etc).
                </p>
              </div>

              {(() => {
                if (loading && !mfaSecret) {
                  return (
                    <div className="flex justify-center py-8">
                      <Loader2 className="text-primary animate-spin" size={40} />
                    </div>
                  );
                }

                if (mfaSecret) {
                  return (
                    <div className="flex flex-col items-center gap-6">
                      <div className="rounded-xl bg-white p-4 shadow-sm">
                        <img
                          alt="QR Code"
                          className="h-48 w-48"
                          decoding="async"
                          loading="lazy"
                          src={mfaSecret.qrCodeUrl}
                        />
                      </div>

                      <div className="form-control w-full max-w-xs">
                        <Input
                          className="text-center text-2xl tracking-widest"
                          inputMode="numeric"
                          label="Ingresa el código de 6 dígitos"
                          maxLength={6}
                          onChange={(e) => {
                            setMfaCode(e.target.value);
                          }}
                          pattern="[0-9]*"
                          placeholder="000000"
                          type="text"
                          value={mfaCode}
                        />
                      </div>

                      <Button
                        className="w-full max-w-xs"
                        disabled={mfaCode.length !== 6 || loading}
                        onClick={verifyMfa}
                        variant="primary"
                      >
                        {loading ? <Loader2 className="animate-spin" /> : "Verificar y activar"}
                      </Button>

                      <div className="flex w-full items-center gap-2 max-w-xs">
                        <Separator className="flex-1" />
                        <span className="text-default-300 text-xs">O usa biometría</span>
                        <Separator className="flex-1" />
                      </div>

                      <Button
                        className="w-full max-w-xs gap-2"
                        disabled={loading}
                        onClick={handlePasskeyRegister}
                        variant="outline"
                      >
                        <Fingerprint size={20} />
                        Registrar passkey (huella/FaceID)
                      </Button>

                      <Button
                        className="text-default-400 hover:text-foreground mt-2"
                        disabled={loading}
                        onClick={handleNext}
                        size="sm"
                        variant="ghost"
                      >
                        Omitir por ahora
                      </Button>
                    </div>
                  );
                }

                return (
                  <div className="text-danger text-center">No se pudo cargar el código QR.</div>
                );
              })()}
            </div>
          )}

          {currentStep === 5 && (
            <div className="animate-in fade-in zoom-in space-y-6 py-8 text-center duration-500">
              <div className="bg-success/10 text-success mx-auto flex h-24 w-24 items-center justify-center rounded-full">
                <Check size={48} strokeWidth={3} />
              </div>
              <div>
                <h1 className="text-foreground text-3xl font-bold">¡Todo listo!</h1>
                <p className="text-default-500 mt-2">
                  Tu perfil ha sido completado y tu cuenta está segura.
                </p>
              </div>
              <Button
                className="shadow-primary/20 w-full max-w-xs shadow-lg"
                disabled={loading}
                onClick={handleFinalSubmit}
                size="lg"
                variant="primary"
              >
                {loading ? <Loader2 className="animate-spin" /> : "Finalizar e ir al dashboard"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
