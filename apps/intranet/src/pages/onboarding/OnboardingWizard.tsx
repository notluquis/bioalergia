import { useNavigate } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { useEffect } from "react";
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
    <div className="border-default-100 border-b px-4 py-4 sm:px-6">
      <div className="relative mx-auto max-w-4xl">
        <div className="absolute top-4 left-0 z-0 h-0.5 w-full bg-default-100" />
        <div
          className="absolute top-4 left-0 z-0 h-0.5 bg-primary"
          style={{ width: `${(currentStep / (STEPS.length - 1)) * 100}%` }}
        />
        <ol className="relative z-10 grid grid-cols-6 gap-2">
          {STEPS.map((step, idx) => (
            <li className="flex min-w-0 flex-col items-center gap-2 text-center" key={step.id}>
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border-2 font-semibold text-xs sm:h-9 sm:w-9",
                  idx <= currentStep
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-default-200 bg-background text-default-500",
                )}
              >
                {idx < currentStep ? <Check size={14} strokeWidth={3} /> : idx + 1}
              </div>
              <span
                className={cn(
                  "line-clamp-2 max-w-[88px] text-[10px] leading-tight uppercase tracking-wide sm:text-[11px]",
                  idx <= currentStep ? "font-semibold text-primary" : "text-default-500",
                )}
              >
                {step.title}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function StepContent({
  currentStep,
  logic,
  userEmail,
}: {
  currentStep: number;
  logic: ReturnType<typeof useOnboardingForm>;
  userEmail: string;
}) {
  if (!logic.profile) {
    return null;
  }
  type M = { mutate: (x?: string) => void };
  const mf = logic.mutations.mfaSetup as unknown as M;
  const mv = logic.mutations.mfaVerify as unknown as M;
  const mp = logic.mutations.passkeyRegister as unknown as M;
  const mf2 = logic.mutations.finalSubmit as unknown as M;
  let stepNode: React.ReactNode = null;
  switch (currentStep) {
    case 0:
      stepNode = <WelcomeStep userEmail={userEmail} onNext={logic.handleNext} />;
      break;
    case 1:
      stepNode = (
        <ProfileStep
          profile={logic.profile}
          onProfileChange={logic.handleProfileChange}
          onNext={logic.handleNext}
          error={logic.error}
          isLoading={logic.isLoading}
        />
      );
      break;
    case 2:
      stepNode = (
        <FinancialStep
          profile={logic.profile}
          onProfileChange={logic.handleProfileChange}
          onNext={logic.handleNext}
          onPrev={logic.handlePrev}
          isLoading={logic.isLoading}
        />
      );
      break;
    case 3:
      stepNode = (
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
      );
      break;
    case 4:
      stepNode = (
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
      );
      break;
    case 5:
      stepNode = <CompleteStep onFinish={() => mf2.mutate()} isLoading={logic.isLoading} />;
      break;
    default:
      stepNode = null;
      break;
  }
  return (
    <>
      {logic.error ? (
        <div className="mb-6 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-danger text-sm">
          {logic.error}
        </div>
      ) : null}
      {stepNode}
    </>
  );
}
export function OnboardingWizard() {
  const { initializing, user } = useAuth();
  const navigate = useNavigate();
  const logic = useOnboardingForm();

  // Session lost while onboarding -> return to login.
  useEffect(() => {
    if (!initializing && !user) {
      void navigate({ replace: true, to: "/login", search: { redirect: "/onboarding" } });
    }
  }, [initializing, navigate, user]);

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
    <div className="flex min-h-screen items-center justify-center bg-default-50 px-4 py-6 sm:py-10">
      <div className="surface-elevated flex w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-default-100">
        <ProgressBar currentStep={logic.currentStep} />
        <div className="mx-auto w-full max-w-2xl p-6 sm:p-8">
          <StepContent
            currentStep={logic.currentStep}
            logic={logic}
            userEmail={user?.email ?? ""}
          />
        </div>
      </div>
    </div>
  );
}
