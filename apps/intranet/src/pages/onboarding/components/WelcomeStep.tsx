import { ArrowRight, Shield } from "lucide-react";

import Button from "@/components/ui/Button";

interface WelcomeStepProps {
  userEmail: string;
  onNext: () => void;
}

export function WelcomeStep({ userEmail, onNext }: WelcomeStepProps) {
  return (
    <div className="fade-in slide-in-from-bottom-4 animate-in space-y-6 py-8 text-center duration-500">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Shield size={40} />
      </div>
      <div>
        <h1 className="break-all font-bold text-2xl text-foreground sm:text-3xl">
          Hola, {userEmail}
        </h1>
        <p className="mx-auto mt-2 max-w-md text-default-500">
          Bienvenido a la intranet de Bioalergia. Antes de comenzar, necesitamos completar tu perfil
          y asegurar tu cuenta.
        </p>
      </div>
      <div className="flex justify-center">
        <Button
          className="gap-2 shadow-lg shadow-primary/20"
          onClick={onNext}
          size="lg"
          variant="primary"
        >
          Comenzar <ArrowRight size={20} />
        </Button>
      </div>
    </div>
  );
}
