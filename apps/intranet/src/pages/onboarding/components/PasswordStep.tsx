import { Button, FieldError, Form, Input, Label, TextField } from "@heroui/react";
import { Key } from "lucide-react";

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
    // Browser validation (validationBehavior="native") ensures password.length >= 8
    // This custom validation is for cross-field logic only
    if (password !== confirmPassword) {
      return;
    }
    onNext();
  };

  return (
    <Form className="space-y-6" onSubmit={handleSubmit} validationBehavior="aria">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-secondary/10 text-secondary">
          <Key size={24} />
        </div>
        <h2 className="font-bold text-2xl">Seguridad</h2>
        <p className="text-default-500 text-sm">Crea una contraseña segura.</p>
      </div>

      <div className="space-y-4">
        <TextField
          isInvalid={Boolean(error)}
          isRequired
          minLength={8}
          name="password"
          type="password"
          validationBehavior="native"
        >
          <Label>Nueva contraseña</Label>
          <Input
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onPasswordChange(e.target.value)}
            value={password}
          />
          <FieldError>Mínimo 8 caracteres</FieldError>
        </TextField>

        <TextField
          isInvalid={Boolean(password !== confirmPassword && confirmPassword)}
          isRequired
          minLength={8}
          name="confirmPassword"
          type="password"
        >
          <Label>Confirmar contraseña</Label>
          <Input
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              onConfirmPasswordChange(e.target.value)
            }
            value={confirmPassword}
          />
          <FieldError>Las contraseñas no coinciden</FieldError>
        </TextField>
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <Button isDisabled={isLoading} onPress={onPrev} type="button" variant="ghost">
          Atrás
        </Button>
        <Button
          className="px-8"
          type="submit"
          variant="primary"
          isDisabled={isLoading || password !== confirmPassword}
        >
          Siguiente
        </Button>
      </div>
    </Form>
  );
}
