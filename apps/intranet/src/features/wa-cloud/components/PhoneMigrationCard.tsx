import { Button, Card, Chip, Label, ListBox, Select } from "@heroui/react";
import { ArrowRight, Check, MailQuestion, PhoneIncoming, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { SelectInput, TextInput } from "@/features/outreach/components/FormField";
import { toast } from "@/lib/toast-interceptor";
import {
  useAccounts,
  useAddMigratingPhone,
  useDeregisterPhone,
  useRegisterPhone,
  useRequestPhoneCode,
  useVerifyPhoneCode,
} from "../hooks/useWaCloud";

// Full Cloud API phone migration wizard (Meta 2026 sequence):
//
//   1. (Opcional) Add phone slot to destination WABA
//      POST /WABA_ID/phone_numbers { cc, phone_number, migrate_phone_number: true }
//      Skip when the operator already added the number via Meta Business
//      Manager — in that case start at step 2 with the existing phoneNumberId.
//
//   2. Request OTP via SMS or VOICE.
//      POST /PHONE_NUMBER_ID/request_code
//
//   3. Operator types the OTP delivered to the SIM.
//      POST /PHONE_NUMBER_ID/verify_code
//
//   4. Set a 6-digit PIN that activates the number in Cloud API and
//      becomes its new 2FA PIN.
//      POST /PHONE_NUMBER_ID/register { messaging_product: "whatsapp", pin }
//
// Preconditions enforced by Meta (not us):
//   - Two-step verification DISABLED on the number's source WABA / app
//     before step 1.
//   - Source + destination WABA under the SAME Meta Business Manager.
//   - Both WABAs have payment method configured.
//
// Refs:
//   - https://developers.facebook.com/docs/whatsapp/cloud-api/reference/phone-numbers
//   - https://respond.io/help/whatsapp/phone-number-migration-to-whatsapp-cloud-api

type Step = "add" | "request" | "verify" | "register" | "done";

const CODE_METHODS: { value: "SMS" | "VOICE"; label: string }[] = [
  { value: "SMS", label: "SMS" },
  { value: "VOICE", label: "Llamada de voz" },
];

const LANGUAGES: { value: string; label: string }[] = [
  { value: "es", label: "Español" },
  { value: "en", label: "English" },
];

export function PhoneMigrationCard() {
  const accounts = useAccounts();
  const addPhone = useAddMigratingPhone();
  const requestCode = useRequestPhoneCode();
  const verifyCode = useVerifyPhoneCode();
  const register = useRegisterPhone();
  const deregister = useDeregisterPhone();

  const allPhones = (accounts.data?.accounts ?? []).flatMap((a) =>
    a.phoneNumbers.map((p) => ({
      id: p.id,
      label: `${p.label ?? p.displayPhoneNumber} (${a.displayName ?? a.wabaId})`,
    }))
  );
  const accountOptions = (accounts.data?.accounts ?? []).map((a) => ({
    value: String(a.id),
    label: a.displayName ?? a.wabaId,
  }));

  const [step, setStep] = useState<Step>("request");
  const [accountId, setAccountId] = useState<string>("");
  const [countryCode, setCountryCode] = useState("56");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneId, setPhoneId] = useState<string>("");
  const [codeMethod, setCodeMethod] = useState<"SMS" | "VOICE">("SMS");
  const [language, setLanguage] = useState("es");
  const [otp, setOtp] = useState("");
  const [pin, setPin] = useState("");

  const numericPhoneId = phoneId ? Number.parseInt(phoneId, 10) : null;

  const doAdd = async () => {
    if (!accountId || !/^\d{1,4}$/.test(countryCode) || !/^\d{4,15}$/.test(phoneNumber)) {
      toast.error("Faltan datos válidos (cuenta + código país + número)");
      return;
    }
    try {
      const r = await addPhone.mutateAsync({
        accountId: Number.parseInt(accountId, 10),
        countryCode,
        phoneNumber,
        migrate: true,
      });
      toast.success(`Número agregado al WABA (phone_id=${r.phoneNumberId})`);
      // The newly-created phone shows up in the WABA but our local
      // wa_phone_numbers table isn't synced until the next account
      // sync. For step 2 the operator picks from the existing list
      // OR re-uses the returned ID via the manual phoneId field.
      setStep("request");
    } catch (err) {
      toast.error(`Error: ${String(err)}`);
    }
  };

  const doRequest = async () => {
    if (!numericPhoneId) {
      toast.error("Selecciona el número primero");
      return;
    }
    try {
      await requestCode.mutateAsync({
        phoneNumberId: numericPhoneId,
        codeMethod,
        language,
      });
      toast.success(`Código enviado por ${codeMethod}`);
      setStep("verify");
    } catch (err) {
      toast.error(`Error: ${String(err)}`);
    }
  };

  const doVerify = async () => {
    if (!numericPhoneId) return;
    if (!/^\d{6}$/.test(otp)) {
      toast.error("OTP debe ser 6 dígitos");
      return;
    }
    try {
      await verifyCode.mutateAsync({ phoneNumberId: numericPhoneId, code: otp });
      toast.success("Número verificado");
      setStep("register");
    } catch (err) {
      toast.error(`Error: ${String(err)}`);
    }
  };

  const doRegister = async () => {
    if (!numericPhoneId) return;
    if (!/^\d{6}$/.test(pin)) {
      toast.error("PIN debe ser 6 dígitos");
      return;
    }
    try {
      await register.mutateAsync({ phoneNumberId: numericPhoneId, pin });
      toast.success("Número activo en Cloud API ✓");
      setStep("done");
    } catch (err) {
      toast.error(`Error: ${String(err)}`);
    }
  };

  const doDeregister = async () => {
    if (!numericPhoneId) {
      toast.error("Selecciona el número");
      return;
    }
    if (
      !confirm(
        "¿Quitar este número del Cloud API? Para volver a usarlo hay que migrarlo nuevamente."
      )
    ) {
      return;
    }
    try {
      await deregister.mutateAsync({ phoneNumberId: numericPhoneId });
      toast.success("Número desregistrado");
      setStep("request");
      setOtp("");
      setPin("");
    } catch (err) {
      toast.error(`Error: ${String(err)}`);
    }
  };

  return (
    <Card>
      <Card.Header className="border-default-200 border-b">
        <Card.Title className="flex items-center gap-2">
          <PhoneIncoming size={16} className="text-accent" />
          Migración / activación de número (Cloud API)
        </Card.Title>
        <Card.Description>
          Flujo Meta 2026: agregar slot en la WABA destino, solicitar OTP, verificar ownership y
          registrar en Cloud API con un nuevo PIN 2FA.
        </Card.Description>
      </Card.Header>
      <Card.Content className="space-y-4">
        <div className="flex gap-2 rounded-lg border border-warning-200 bg-warning-50 p-3 text-warning-900 text-xs">
          <ShieldAlert size={16} className="shrink-0" />
          <p>
            Antes de empezar: deshabilita verificación en dos pasos del número en su origen (app
            WhatsApp Business o WABA fuente), confirma que ambas WABAs están bajo el mismo Meta
            Business Manager y tienen método de pago configurado.
          </p>
        </div>

        <StepIndicator step={step} />

        {/* Optional Step 1: provision phone slot in destination WABA */}
        <details className="rounded-lg border border-default-200 bg-content2">
          <summary className="cursor-pointer p-3 font-medium text-sm">
            Opcional — agregar slot del número a esta WABA
          </summary>
          <div className="space-y-3 border-default-200 border-t p-3">
            <p className="text-default-500 text-xs">
              Solo si no agregaste el número en Meta Business Manager primero. Esto llama{" "}
              <code>POST /WABA_ID/phone_numbers</code> con <code>migrate_phone_number=true</code>.
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <SelectInput
                label="Cuenta (WABA destino)"
                value={accountId}
                onValueChange={setAccountId}
                options={accountOptions}
              />
              <TextInput
                label="Código país (sin +)"
                value={countryCode}
                onValueChange={(v) => setCountryCode(v.replace(/\D/g, "").slice(0, 4))}
                placeholder="56"
              />
              <TextInput
                label="Número (sin código país)"
                value={phoneNumber}
                onValueChange={(v) => setPhoneNumber(v.replace(/\D/g, "").slice(0, 15))}
                placeholder="912345678"
              />
            </div>
            <div className="flex justify-end">
              <Button onPress={doAdd} isPending={addPhone.isPending} size="sm">
                <ArrowRight size={14} />
                <span>Agregar y migrar</span>
              </Button>
            </div>
          </div>
        </details>

        {/* Phone selector — shared across steps */}
        <div>
          <SelectInput
            label="Número a migrar/activar"
            value={phoneId}
            onValueChange={setPhoneId}
            options={allPhones.map((p) => ({ value: String(p.id), label: p.label }))}
          />
        </div>

        {step === "request" && (
          <div className="space-y-3 rounded-lg border border-default-200 bg-content2 p-3">
            <p className="font-medium text-sm">Paso 1 — Solicitar OTP</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Select
                value={codeMethod}
                onChange={(k) => k && setCodeMethod(k as "SMS" | "VOICE")}
                variant="secondary"
              >
                <Label>Método</Label>
                <Select.Trigger>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    {CODE_METHODS.map((o) => (
                      <ListBox.Item key={o.value} id={o.value}>
                        {o.label}
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>
              <Select
                value={language}
                onChange={(k) => k && setLanguage(String(k))}
                variant="secondary"
              >
                <Label>Idioma</Label>
                <Select.Trigger>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    {LANGUAGES.map((o) => (
                      <ListBox.Item key={o.value} id={o.value}>
                        {o.label}
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>
            </div>
            <div className="flex justify-end">
              <Button onPress={doRequest} isPending={requestCode.isPending} size="sm">
                <ArrowRight size={14} />
                <span>Enviar código</span>
              </Button>
            </div>
          </div>
        )}

        {step === "verify" && (
          <div className="space-y-3 rounded-lg border border-default-200 bg-content2 p-3">
            <p className="font-medium text-sm">Paso 2 — Verificar OTP</p>
            <p className="text-default-500 text-xs">
              Ingresa el código de 6 dígitos recibido por {codeMethod}.
            </p>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <TextInput
                  label="Código OTP"
                  value={otp}
                  onValueChange={(v) => setOtp(v.replace(/\D/g, "").slice(0, 6))}
                  placeholder="123456"
                />
              </div>
              <Button variant="secondary" onPress={() => setStep("request")} size="sm">
                <span>Reenviar</span>
              </Button>
              <Button onPress={doVerify} isPending={verifyCode.isPending} size="sm">
                <Check size={14} />
                <span>Verificar</span>
              </Button>
            </div>
          </div>
        )}

        {step === "register" && (
          <div className="space-y-3 rounded-lg border border-default-200 bg-content2 p-3">
            <p className="font-medium text-sm">Paso 3 — Registrar y activar</p>
            <p className="text-default-500 text-xs">
              PIN de 6 dígitos. Será el nuevo PIN 2FA del número en Cloud API — guárdalo en el
              password manager.
            </p>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <TextInput
                  label="PIN 2FA (6 dígitos)"
                  value={pin}
                  onValueChange={(v) => setPin(v.replace(/\D/g, "").slice(0, 6))}
                  placeholder="987654"
                />
              </div>
              <Button onPress={doRegister} isPending={register.isPending} size="sm">
                <MailQuestion size={14} />
                <span>Registrar</span>
              </Button>
            </div>
          </div>
        )}

        {step === "done" && (
          <div className="space-y-2 rounded-lg border border-success-200 bg-success-50 p-3 text-success-900">
            <p className="font-medium text-sm">Número activo en Cloud API ✓</p>
            <p className="text-xs">
              Puedes empezar a enviar mensajes desde la bandeja. Para usarlo a la vez en la app
              WhatsApp Business consulta Coexistence (Meta 2024) — no implementado aquí todavía.
            </p>
          </div>
        )}

        <div className="border-default-200 border-t pt-3">
          <Button
            variant="danger"
            size="sm"
            onPress={doDeregister}
            isPending={deregister.isPending}
          >
            <span>Desregistrar del Cloud API</span>
          </Button>
        </div>
      </Card.Content>
    </Card>
  );
}

function StepIndicator({ step }: { step: Step }) {
  const steps: { id: Step; label: string }[] = [
    { id: "request", label: "Solicitar" },
    { id: "verify", label: "Verificar" },
    { id: "register", label: "Registrar" },
    { id: "done", label: "Listo" },
  ];
  const activeIdx = steps.findIndex((s) => s.id === step);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {steps.map((s, idx) => (
        <Chip
          key={s.id}
          size="sm"
          variant={idx === activeIdx ? "primary" : "soft"}
          color={idx < activeIdx ? "success" : idx === activeIdx ? "accent" : "default"}
        >
          <Chip.Label>
            {idx + 1}. {s.label}
          </Chip.Label>
        </Chip>
      ))}
    </div>
  );
}
