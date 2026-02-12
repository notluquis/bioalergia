import { Check } from "lucide-react";

import { Button } from "@/components/ui/Button";

interface CompleteStepProps {
  onFinish: () => void;
  isLoading?: boolean;
}

export function CompleteStep({ onFinish, isLoading }: CompleteStepProps) {
  return (
    <div className="space-y-6 py-8 text-center">
      <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-success/10 text-success">
        <Check size={48} strokeWidth={3} />
      </div>
      <div>
        <h1 className="font-bold text-3xl text-foreground">¡Todo listo!</h1>
        <p className="mt-2 text-default-500">
          Tu perfil ha sido completado y tu cuenta está segura.
        </p>
      </div>
      <Button
        className="w-full max-w-xs"
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
