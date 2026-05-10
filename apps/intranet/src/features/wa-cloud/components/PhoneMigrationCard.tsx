import { Button, Card } from "@heroui/react";
import { useState } from "react";
import { SelectInput, TextInput } from "@/features/outreach/components/FormField";
import { toast } from "@/lib/toast-interceptor";
import { useAccounts, useRequestPhoneCode, useVerifyPhoneCode } from "../hooks/useWaCloud";

// Two-step UI for migrating a phone between WABAs:
//   1. Pick the new-WABA phone row, send OTP via SMS or VOICE.
//   2. Read code from physical SIM, paste, verify.
// Source WABA must already have deregistered the number.
export function PhoneMigrationCard() {
  const accounts = useAccounts();
  const allPhones = (accounts.data?.accounts ?? []).flatMap((a) =>
    a.phoneNumbers.map((p) => ({
      id: p.id,
      label: `${p.label ?? p.displayPhoneNumber} (${a.displayName ?? a.wabaId})`,
    })),
  );
  const [phoneId, setPhoneId] = useState("");
  const [method, setMethod] = useState<"SMS" | "VOICE">("SMS");
  const [code, setCode] = useState("");

  const request = useRequestPhoneCode();
  const verify = useVerifyPhoneCode();
  const numericPhoneId = phoneId ? Number.parseInt(phoneId, 10) : undefined;

  const sendCode = () => {
    if (!numericPhoneId) {
      toast.error("Selecciona un número primero");
      return;
    }
    request.mutate(
      { phoneNumberId: numericPhoneId, codeMethod: method, language: "es" },
      {
        onSuccess: () => toast.success(`Código enviado vía ${method}. Revisa el teléfono físico.`),
        onError: (e) => toast.error(`Meta: ${String(e)}`),
      },
    );
  };

  const verifyOtp = () => {
    if (!numericPhoneId) {
      toast.error("Selecciona un número primero");
      return;
    }
    if (!/^\d{6}$/.test(code)) {
      toast.error("Código debe ser 6 dígitos");
      return;
    }
    verify.mutate(
      { phoneNumberId: numericPhoneId, code },
      {
        onSuccess: () => {
          toast.success("Migración completada");
          setCode("");
        },
        onError: (e) => toast.error(`Verify falló: ${String(e)}`),
      },
    );
  };

  return (
    <Card>
      <Card.Header>
        <Card.Title>Migración de número entre WABAs</Card.Title>
        <Card.Description>
          Mover un número desde otra WhatsApp Business Account hacia esta. La cuenta origen debe
          haber deregistrado el número primero.
        </Card.Description>
      </Card.Header>
      <Card.Content className="space-y-4">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <SelectInput
            label="Número (nueva WABA)"
            value={phoneId}
            onValueChange={setPhoneId}
            options={allPhones.map((p) => ({ value: String(p.id), label: p.label }))}
          />
          <SelectInput
            label="Método de OTP"
            value={method}
            onValueChange={(v) => setMethod(v as "SMS" | "VOICE")}
            options={[
              { value: "SMS", label: "SMS" },
              { value: "VOICE", label: "Llamada (voz)" },
            ]}
          />
          <div className="flex items-end">
            <Button onPress={sendCode} isPending={request.isPending} fullWidth>
              1. Enviar código
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <TextInput
              label="Código recibido (6 dígitos)"
              value={code}
              onValueChange={setCode}
              placeholder="123456"
            />
          </div>
          <div className="flex items-end">
            <Button onPress={verifyOtp} isPending={verify.isPending} fullWidth>
              2. Verificar y migrar
            </Button>
          </div>
        </div>
      </Card.Content>
    </Card>
  );
}
