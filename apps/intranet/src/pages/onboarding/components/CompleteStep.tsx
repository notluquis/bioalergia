import { Button } from "@heroui/react";
import { Check } from "lucide-react";

interface CompleteStepProps {
  onFinish: () => void;
  isLoading?: boolean;
}

export function CompleteStep({ onFinish, isLoading }: CompleteStepProps) {
  return (
    <div className="space-y-6 py-8 text-center">
      <div className="mx-auto flex items-center justify-center rounded-full bg-success/10 text-success size-24">
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
        isDisabled={isLoading}
        onPress={onFinish}
        size="lg"
        variant="primary"
      >
        Ir a la intranet
      </Button>
    </div>
  );
}
