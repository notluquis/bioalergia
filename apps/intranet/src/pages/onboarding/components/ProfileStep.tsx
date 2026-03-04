import { Button, Description, FieldError, Input, Label, TextField } from "@heroui/react";
import { User } from "lucide-react";
import { formatRut, validateRut } from "@/lib/rut";

interface ProfileStepProps {
  profile: {
    loginEmail: string;
    names: string;
    rut: string;
    phone: string;
    address: string;
    fatherName: string;
    motherName: string;
  };
  onProfileChange: (field: string, value: string) => void;
  onNext: () => void;
  isLoading?: boolean;
  error?: string | null;
}

export function ProfileStep(props: ProfileStepProps) {
  const { profile, onProfileChange, onNext, isLoading, error } = props;
  const handleSubmit = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (profile.names && validateRut(profile.rut)) {
      onNext();
    }
  };
  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <User size={24} />
        </div>
        <h2 className="font-bold text-2xl">Datos personales</h2>
        <p className="text-default-500 text-sm">Información básica para tu perfil.</p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TextField isRequired name="names">
          <Label>Nombres</Label>
          <Input onChange={(e) => onProfileChange("names", e.target.value)} value={profile.names} />
        </TextField>

        <TextField isRequired name="loginEmail" type="email">
          <Label>Correo de login</Label>
          <Input
            onChange={(e) => onProfileChange("loginEmail", e.target.value)}
            value={profile.loginEmail}
          />
          <Description>
            Puedes usar otro correo solo para iniciar sesión. Si no, usa el mismo actual.
          </Description>
        </TextField>

        <TextField isInvalid={Boolean(error?.includes("RUT"))} isRequired name="rut" type="text">
          <Label>RUT</Label>
          <Input
            onBlur={() => onProfileChange("rut", formatRut(profile.rut))}
            onChange={(e) => onProfileChange("rut", e.target.value)}
            placeholder="12.345.678-9"
            value={profile.rut}
          />
          <FieldError>RUT inválido</FieldError>
        </TextField>

        <TextField name="fatherName">
          <Label>Primer apellido</Label>
          <Input
            onChange={(e) => onProfileChange("fatherName", e.target.value)}
            value={profile.fatherName}
          />
        </TextField>

        <TextField name="motherName">
          <Label>Segundo apellido</Label>
          <Input
            onChange={(e) => onProfileChange("motherName", e.target.value)}
            value={profile.motherName}
          />
        </TextField>

        <TextField name="phone" type="tel">
          <Label>Teléfono</Label>
          <Input onChange={(e) => onProfileChange("phone", e.target.value)} value={profile.phone} />
        </TextField>

        <div className="md:col-span-2">
          <TextField name="address">
            <Label>Dirección</Label>
            <Input
              onChange={(e) => onProfileChange("address", e.target.value)}
              value={profile.address}
            />
          </TextField>
        </div>
      </div>
      <div className="mt-6 flex justify-end">
        <Button
          className="px-8"
          type="submit"
          variant="primary"
          isDisabled={isLoading || !profile.names || !validateRut(profile.rut)}
        >
          Siguiente
        </Button>
      </div>
    </form>
  );
}
