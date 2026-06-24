import { Button } from "@heroui/react";
import { ArrowRight, Shield } from "lucide-react";

interface WelcomeStepProps {
  userEmail: string;
  onNext: () => void;
}

export function WelcomeStep({ userEmail, onNext }: WelcomeStepProps) {
  return (
    <div className="space-y-6 py-8 text-center">
      <div className="mx-auto flex items-center justify-center rounded-full bg-primary/10 text-primary size-20">
        <Shield size={40} />
      </div>
      <div>
        <h1 className="break-all font-bold text-2xl text-foreground sm:text-3xl">
          {userEmail ? `Hola, ${userEmail}` : "Hola"}
        </h1>
        <p className="mx-auto mt-2 max-w-md text-default-500">
          Bienvenido a la intranet de Bioalergia. Antes de comenzar, necesitamos completar tu perfil
          y asegurar tu cuenta.
        </p>
      </div>
      <div className="flex justify-center">
        <Button className="gap-2" onPress={onNext} size="lg" variant="primary">
          Comenzar <ArrowRight size={20} />
        </Button>
      </div>
    </div>
  );
}
