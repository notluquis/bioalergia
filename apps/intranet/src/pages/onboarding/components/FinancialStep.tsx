import { CreditCard } from "lucide-react";

import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

interface FinancialStepProps {
  profile: {
    bankName: string;
    bankAccountType: string;
    bankAccountNumber: string;
  };
  onProfileChange: (field: string, value: string) => void;
  onNext: () => void;
  onPrev: () => void;
  isLoading?: boolean;
}

export function FinancialStep({
  profile,
  onProfileChange,
  onNext,
  onPrev,
  isLoading,
}: FinancialStepProps) {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onNext();
  };

  return (
    <form
      className="animate-in fade-in slide-in-from-right-4 space-y-6 duration-500"
      onSubmit={handleSubmit}
    >
      <div className="mb-6 text-center">
        <div className="bg-secondary/10 text-secondary mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full">
          <CreditCard size={24} />
        </div>
        <h2 className="text-2xl font-bold">Datos bancarios</h2>
        <p className="text-default-500 text-sm">Para gestionar tus pagos y remuneraciones.</p>
      </div>

      <div className="space-y-4">
        <Input
          label="Banco"
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            onProfileChange("bankName", e.target.value)
          }
          placeholder="Ej: Banco de Chile"
          value={profile.bankName}
        />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Input
            as="select"
            label="Tipo de cuenta"
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
              onProfileChange("bankAccountType", e.target.value)
            }
            value={profile.bankAccountType}
          >
            <option value="">Seleccionar...</option>
            <option value="Corriente">Cuenta corriente</option>
            <option value="Vista">Cuenta vista / RUT</option>
            <option value="Ahorro">Cuenta de ahorro</option>
          </Input>
          <Input
            label="Número de cuenta"
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              onProfileChange("bankAccountNumber", e.target.value)
            }
            value={profile.bankAccountNumber}
          />
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <Button onClick={onPrev} type="button" variant="ghost" disabled={isLoading}>
          Atrás
        </Button>
        <Button className="px-8" type="submit" variant="primary" disabled={isLoading}>
          Siguiente
        </Button>
      </div>
    </form>
  );
}
