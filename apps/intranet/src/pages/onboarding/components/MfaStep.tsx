import { Separator } from "@heroui/react";
import { Fingerprint, Loader2, Smartphone } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

interface MfaSecretData {
  qrCodeUrl: string;
  secret: string;
}

interface MfaStepProps {
  mfaSecret: MfaSecretData | null;
  mfaCode: string;
  onMfaCodeChange: (value: string) => void;
  onSetupMfa: () => void;
  onVerifyMfa: () => void;
  onPasskeyRegister: () => void;
  onSkip: () => void;
  isLoading?: boolean;
}

export function MfaStep({
  mfaSecret,
  mfaCode,
  onMfaCodeChange,
  onSetupMfa,
  onVerifyMfa,
  onPasskeyRegister,
  onSkip,
  isLoading,
}: MfaStepProps) {
  if (isLoading && !mfaSecret) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="animate-spin text-primary" size={40} />
      </div>
    );
  }

  if (!mfaSecret) {
    return (
      <div className="space-y-6">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-warning/10 text-warning">
            <Smartphone size={24} />
          </div>
          <h2 className="font-bold text-2xl">Configurar MFA</h2>
          <p className="text-default-500 text-sm">
            Escanea el código con tu app de autenticación (Google Authenticator, Microsoft
            Authenticator, Apple Passwords, etc).
          </p>
        </div>
        <Button onClick={onSetupMfa} variant="primary" disabled={isLoading}>
          Generar código QR
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-warning/10 text-warning">
          <Smartphone size={24} />
        </div>
        <h2 className="font-bold text-2xl">Configurar MFA</h2>
        <p className="text-default-500 text-sm">
          Escanea el código con tu app de autenticación (Google Authenticator, Microsoft
          Authenticator, Apple Passwords, etc).
        </p>
      </div>

      <div className="flex flex-col items-center gap-6">
        <div className="rounded-xl bg-white p-4">
          <img
            alt="QR Code"
            className="h-48 w-48"
            decoding="async"
            loading="lazy"
            src={mfaSecret.qrCodeUrl}
          />
        </div>

        <div className="w-full max-w-xs">
          <Input
            className="text-center text-2xl tracking-widest"
            inputMode="numeric"
            label="Ingresa el código de 6 dígitos"
            maxLength={6}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onMfaCodeChange(e.target.value)}
            pattern="[0-9]*"
            placeholder="000000"
            type="text"
            value={mfaCode}
          />
        </div>

        <div className="flex justify-center">
          <Button
            disabled={mfaCode.length !== 6 || isLoading}
            onClick={onVerifyMfa}
            variant="primary"
          >
            {isLoading ? <Loader2 className="animate-spin" /> : "Verificar y activar"}
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Separator className="flex-1" />
          <span className="text-default-300 text-xs">O usa biometría</span>
          <Separator className="flex-1" />
        </div>

        <div className="flex justify-center">
          <Button
            className="gap-2"
            disabled={isLoading}
            onClick={onPasskeyRegister}
            variant="outline"
          >
            <Fingerprint size={20} />
            Registrar passkey (huella/FaceID)
          </Button>
        </div>

        <div className="flex justify-center">
          <Button
            className="text-default-400 hover:text-foreground"
            disabled={isLoading}
            onClick={onSkip}
            size="sm"
            variant="ghost"
          >
            Omitir por ahora
          </Button>
        </div>
      </div>
    </div>
  );
}
