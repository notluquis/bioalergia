import { Button, Description, FieldError, Form, Input, Label, TextField } from "@heroui/react";
import { User } from "lucide-react";
import { formatRut, validateRut } from "@/lib/rut";

interface ProfileStepProps {
  profile: {
    loginEmail: string;
    names: string;
    rut: string;
    phone: string;
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
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (profile.names && validateRut(profile.rut)) {
      onNext();
    }
  };
  return (
    <Form className="space-y-6" onSubmit={handleSubmit} validationBehavior="aria">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex items-center justify-center rounded-full bg-primary/10 text-primary size-12">
          <User size={24} />
        </div>
        <h2 className="font-bold text-2xl">Datos personales</h2>
        <p className="text-default-500 text-sm">Información básica para tu perfil.</p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TextField
          isRequired
          name="names"
          onChange={(v) => onProfileChange("names", v)}
          value={profile.names}
        >
          <Label>Nombres</Label>
          <Input />
        </TextField>

        <TextField
          isRequired
          name="loginEmail"
          onChange={(v) => onProfileChange("loginEmail", v)}
          type="email"
          value={profile.loginEmail}
        >
          <Label>Correo de login</Label>
          <Input />
          <Description>
            Puedes usar otro correo solo para iniciar sesión. Si no, usa el mismo actual.
          </Description>
        </TextField>

        <TextField
          isInvalid={Boolean(error?.includes("RUT"))}
          isRequired
          name="rut"
          onChange={(v) => onProfileChange("rut", v)}
          type="text"
          value={profile.rut}
        >
          <Label>RUT</Label>
          <Input
            onBlur={() => onProfileChange("rut", formatRut(profile.rut))}
            placeholder="12.345.678-9"
          />
          <FieldError>RUT inválido</FieldError>
        </TextField>

        <TextField
          name="fatherName"
          onChange={(v) => onProfileChange("fatherName", v)}
          value={profile.fatherName}
        >
          <Label>Primer apellido</Label>
          <Input />
        </TextField>

        <TextField
          name="motherName"
          onChange={(v) => onProfileChange("motherName", v)}
          value={profile.motherName}
        >
          <Label>Segundo apellido</Label>
          <Input />
        </TextField>

        <TextField
          name="phone"
          onChange={(v) => onProfileChange("phone", v)}
          type="tel"
          value={profile.phone}
        >
          <Label>Teléfono</Label>
          <Input />
        </TextField>
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
    </Form>
  );
}
