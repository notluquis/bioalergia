import { User } from "lucide-react";

import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { formatRut, validateRut } from "@/lib/rut";

interface ProfileStepProps {
  profile: {
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
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (profile.names && validateRut(profile.rut)) onNext();
  };
  return (
    <form
      className="animate-in fade-in slide-in-from-right-4 space-y-6 duration-500"
      onSubmit={handleSubmit}
    >
      <div className="mb-6 text-center">
        <div className="bg-primary/10 text-primary mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full">
          <User size={24} />
        </div>
        <h2 className="text-2xl font-bold">Datos personales</h2>
        <p className="text-default-500 text-sm">Información básica para tu perfil.</p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Input
          label="Nombres"
          onChange={(e) => onProfileChange("names", e.target.value)}
          required
          value={profile.names}
        />
        <Input
          label="RUT"
          error={error?.includes("RUT") ? "RUT inválido" : undefined}
          onChange={(e) => onProfileChange("rut", e.target.value)}
          onBlur={() => onProfileChange("rut", formatRut(profile.rut))}
          placeholder="12.345.678-9"
          required
          value={profile.rut}
        />
        <Input
          label="Primer apellido"
          onChange={(e) => onProfileChange("fatherName", e.target.value)}
          value={profile.fatherName}
        />
        <Input
          label="Segundo apellido"
          onChange={(e) => onProfileChange("motherName", e.target.value)}
          value={profile.motherName}
        />
        <Input
          label="Teléfono"
          onChange={(e) => onProfileChange("phone", e.target.value)}
          type="tel"
          value={profile.phone}
        />
        <div className="md:col-span-2">
          <Input
            label="Dirección"
            onChange={(e) => onProfileChange("address", e.target.value)}
            value={profile.address}
          />
        </div>
      </div>
      <div className="mt-6 flex justify-end">
        <Button
          className="px-8"
          type="submit"
          variant="primary"
          disabled={isLoading || !profile.names || !validateRut(profile.rut)}
        >
          Siguiente
        </Button>
      </div>
    </form>
  );
}
