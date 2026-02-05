import { useNavigate } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { useEffect } from "react";
import { Alert } from "@/components/ui/Alert";

import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import { CompleteStep } from "./components/CompleteStep";
import { FinancialStep } from "./components/FinancialStep";
import { MfaStep } from "./components/MfaStep";
import { PasswordStep } from "./components/PasswordStep";
import { ProfileStep } from "./components/ProfileStep";
import { WelcomeStep } from "./components/WelcomeStep";
import { useOnboardingForm } from "./hooks/useOnboardingForm";

const STEPS = [
  { id: "welcome", title: "Bienvenida" },
  { id: "profile", title: "Datos personales" },
  { id: "financial", title: "Datos bancarios" },
  { id: "password", title: "Contraseña" },
  { id: "mfa", title: "MFA" },
  { id: "complete", title: "Listo" },
];

function ProgressBar({ currentStep }: { currentStep: number }) {
  return (
    <div className="mb-4 p-4">
      <div className="relative mx-auto flex max-w-4xl items-center justify-between px-4">
        <div className="absolute top-1/2 left-0 z-0 h-0.5 w-full -translate-y-1/2 bg-default-100" />
        <div
          className="absolute top-1/2 left-0 z-0 h-0.5 -translate-y-1/2 bg-primary transition-all duration-500"
          style={{ width: `${(currentStep / (STEPS.length - 1)) * 100}%` }}
        />

        {STEPS.map((step, idx) => (
          <div className="relative z-10 flex flex-col items-center gap-2 px-1" key={step.id}>
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full border-4 font-bold text-xs transition-all duration-300 sm:h-10 sm:w-10 sm:text-sm",
                idx <= currentStep
                  ? "scale-110 border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/30"
                  : "border-default-100 bg-background text-default-400",
              )}
            >
              {idx < currentStep ? <Check size={14} strokeWidth={3} /> : idx + 1}
            </div>
            <span
              className={cn(
                "absolute top-full mt-2 whitespace-nowrap font-medium text-[10px] uppercase tracking-wider transition-colors",
                idx <= currentStep ? "text-primary" : "text-default-500",
                "hidden sm:block",
                idx === currentStep && "block",
                "left-1/2 -translate-x-1/2",
              )}
            >
              {step.title}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StepContent({
  currentStep,
  logic,
}: {
  currentStep: number;
  logic: ReturnType<typeof useOnboardingForm>;
}) {
  if (!logic.profile) {
    return null;
  }
  type M = { mutate: (x?: string) => void };
  const mf = logic.mutations.mfaSetup as unknown as M;
  const mv = logic.mutations.mfaVerify as unknown as M;
  const mp = logic.mutations.passkeyRegister as unknown as M;
  const mf2 = logic.mutations.finalSubmit as unknown as M;
  const s = {
    0: <WelcomeStep userEmail="" onNext={logic.handleNext} />,
    1: (
      <ProfileStep
        profile={logic.profile}
        onProfileChange={logic.handleProfileChange}
        onNext={logic.handleNext}
        error={logic.error}
        isLoading={logic.isLoading}
      />
    ),

    2: (
      <FinancialStep
        profile={logic.profile}
        onProfileChange={logic.handleProfileChange}
        onNext={logic.handleNext}
        onPrev={logic.handlePrev}
        isLoading={logic.isLoading}
      />
    ),

    3: (
      <PasswordStep
        password={logic.password}
        confirmPassword={logic.confirmPassword}
        onPasswordChange={logic.setPassword}
        onNext={logic.handleNext}
        onConfirmPasswordChange={logic.setConfirmPassword}
        onPrev={logic.handlePrev}
        isLoading={logic.isLoading}
        error={logic.error}
      />
    ),

    4: (
      <MfaStep
        mfaSecret={logic.mfaSecret}
        mfaCode={logic.mfaCode}
        onMfaCodeChange={logic.setMfaCode}
        onSetupMfa={() => mf.mutate()}
        onVerifyMfa={() => mv.mutate(logic.mfaCode)}
        onPasskeyRegister={() => mp.mutate()}
        onSkip={logic.handleNext}
        isLoading={logic.isLoading}
      />
    ),

    5: <CompleteStep onFinish={() => mf2.mutate()} isLoading={logic.isLoading} />,
  } as Record<number, React.ReactNode>;
  return (
    <>
      {logic.error && (
        <Alert variant="error" className="mb-6">
          <span>{logic.error}</span>
        </Alert>
      )}{" "}
      {s[currentStep]}
    </>
  );
}
export function OnboardingWizard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const logic = useOnboardingForm();

  // Redirect if already completed
  useEffect(() => {
    if (user && user.status !== "PENDING_SETUP") {
      void navigate({ replace: true, to: "/" });
    }
  }, [user, navigate]);

  // Redirect on final submit
  useEffect(() => {
    if (logic.mutations.finalSubmit.isSuccess) {
      void navigate({ to: "/", replace: true });
    }
  }, [logic.mutations.finalSubmit.isSuccess, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-default-50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-background shadow-xl">
        <ProgressBar currentStep={logic.currentStep} />
        <div className="flex-1 overflow-y-auto p-6 sm:p-8">
          <StepContent currentStep={logic.currentStep} logic={logic} />
        </div>
      </div>
    </div>
  );
}
