import { Label, ListBox, Select } from "@heroui/react";
import { CreditCard } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

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
  const NO_ACCOUNT_TYPE_KEY = "__no_account_type__";

  const handleSubmit = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    onNext();
  };

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-secondary/10 text-secondary">
          <CreditCard size={24} />
        </div>
        <h2 className="font-bold text-2xl">Datos bancarios</h2>
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
          <Select
            onChange={(key) =>
              onProfileChange("bankAccountType", key === NO_ACCOUNT_TYPE_KEY ? "" : (key as string))
            }
            value={profile.bankAccountType || NO_ACCOUNT_TYPE_KEY}
          >
            <Label>Tipo de cuenta</Label>
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                <ListBox.Item id={NO_ACCOUNT_TYPE_KEY} key={NO_ACCOUNT_TYPE_KEY}>
                  Seleccionar...
                </ListBox.Item>
                <ListBox.Item id="Corriente" key="Corriente" textValue="Cuenta corriente">
                  Cuenta corriente
                </ListBox.Item>
                <ListBox.Item id="Vista" key="Vista" textValue="Cuenta vista / RUT">
                  Cuenta vista / RUT
                </ListBox.Item>
                <ListBox.Item id="Ahorro" key="Ahorro" textValue="Cuenta de ahorro">
                  Cuenta de ahorro
                </ListBox.Item>
              </ListBox>
            </Select.Popover>
          </Select>
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
