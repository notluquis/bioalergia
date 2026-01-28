import { Check } from "lucide-react";

import Button from "@/components/ui/Button";

interface CompleteStepProps {
  onFinish: () => void;
  isLoading?: boolean;
}

export function CompleteStep({ onFinish, isLoading }: CompleteStepProps) {
  return (
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
        disabled={isLoading}
        onClick={onFinish}
        size="lg"
        variant="primary"
      >
        Ir a la intranet
      </Button>
    </div>
  );
}
