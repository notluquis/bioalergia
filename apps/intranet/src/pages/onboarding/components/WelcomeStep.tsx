import { ArrowRight, Shield } from "lucide-react";

import Button from "@/components/ui/Button";

interface WelcomeStepProps {
  userEmail: string;
  onNext: () => void;
}

export function WelcomeStep({ userEmail, onNext }: WelcomeStepProps) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 space-y-6 py-8 text-center duration-500">
      <div className="bg-primary/10 text-primary mx-auto flex h-20 w-20 items-center justify-center rounded-full">
        <Shield size={40} />
      </div>
      <div>
        <h1 className="text-foreground text-2xl font-bold break-all sm:text-3xl">
          Hola, {userEmail}
        </h1>
        <p className="text-default-500 mx-auto mt-2 max-w-md">
          Bienvenido a la intranet de Bioalergia. Antes de comenzar, necesitamos completar tu perfil
          y asegurar tu cuenta.
        </p>
      </div>
      <div className="flex justify-center">
        <Button
          className="shadow-primary/20 gap-2 shadow-lg"
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
