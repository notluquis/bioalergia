import { Key } from "lucide-react";

import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

interface PasswordStepProps {
  password: string;
  confirmPassword: string;
  onPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onNext: () => void;
  onPrev: () => void;
  isLoading?: boolean;
  error?: string | null;
}

export function PasswordStep({
  password,
  confirmPassword,
  onPasswordChange,
  onConfirmPasswordChange,
  onNext,
  onPrev,
  isLoading,
  error,
}: PasswordStepProps) {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (password.length < 8) return;
    if (password !== confirmPassword) return;
    onNext();
  };

  return (
    <form
      className="animate-in fade-in slide-in-from-right-4 space-y-6 duration-500"
      onSubmit={handleSubmit}
    >
      <div className="mb-6 text-center">
        <div className="bg-secondary/10 text-secondary mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full">
          <Key size={24} />
        </div>
        <h2 className="text-2xl font-bold">Seguridad</h2>
        <p className="text-default-500 text-sm">Crea una contraseña segura.</p>
      </div>

      <div className="space-y-4">
        <Input
          label="Nueva contraseña"
          minLength={8}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onPasswordChange(e.target.value)}
          required
          type="password"
          value={password}
          error={error && password.length < 8 ? "Mínimo 8 caracteres" : undefined}
        />
        <Input
          label="Confirmar contraseña"
          minLength={8}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            onConfirmPasswordChange(e.target.value)
          }
          required
          type="password"
          value={confirmPassword}
          error={
            password !== confirmPassword && confirmPassword
              ? "Las contraseñas no coinciden"
              : undefined
          }
        />
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <Button onClick={onPrev} type="button" variant="ghost" disabled={isLoading}>
          Atrás
        </Button>
        <Button
          className="px-8"
          type="submit"
          variant="primary"
          disabled={isLoading || password.length < 8 || password !== confirmPassword}
        >
          Siguiente
        </Button>
      </div>
    </form>
  );
}
