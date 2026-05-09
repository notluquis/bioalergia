import { Button, Card, Chip, Modal, Spinner } from "@heroui/react";
import {
  Check,
  Copy,
  KeyRound,
  Phone,
  Plus,
  RefreshCw,
  ShieldCheck,
  Tag,
  Trash2,
  Wrench,
  X,
} from "lucide-react";
import { useState } from "react";
import { TextInput } from "@/features/outreach/components/FormField";
import { toast } from "@/lib/toast-interceptor";
import { PhoneToolsModal } from "../components/PhoneToolsModal";
import {
  useAccounts,
  useDeleteAccount,
  useSyncPhones,
  useSyncTemplates,
  useUpsertAccount,
  useUpsertPhoneNumber,
  useValidateAccount,
} from "../hooks/useWaCloud";

type AccountsData = NonNullable<ReturnType<typeof useAccounts>["data"]>;
type AccountSummary = AccountsData["accounts"][number];

const QUALITY_COLOR: Record<string, "success" | "warning" | "danger" | "default"> = {
  GREEN: "success",
  YELLOW: "warning",
  RED: "danger",
  UNKNOWN: "default",
};

export function WaCloudSettingsPage() {
  const accounts = useAccounts();
  const [createOpen, setCreateOpen] = useState(false);

  if (accounts.isLoading || !accounts.data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const webhookBase =
    typeof window !== "undefined" ? `${window.location.origin}/api/webhooks/meta/whatsapp` : "";

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex justify-end">
        <Button onPress={() => setCreateOpen(true)}>
          <Plus size={16} />
          Nueva cuenta WABA
        </Button>
      </div>

      <WebhookCard url={webhookBase} />

      {accounts.data.accounts.length === 0 ? (
        <Card>
          <Card.Content className="p-8 text-center text-default-500 text-sm">
            Aún no hay cuentas WABA. Crea una para comenzar.
          </Card.Content>
        </Card>
      ) : (
        accounts.data.accounts.map((acc) => <AccountCard key={acc.id} acc={acc} />)
      )}

      <CreateAccountModal isOpen={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

function WebhookCard({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("URL copiada");
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <Card variant="secondary">
      <Card.Header>
        <Card.Title>Webhook Meta</Card.Title>
        <Card.Description>
          Pega esta URL en Meta Business Manager → tu app → WhatsApp → Configuración → Webhook URL.
          Verify token = el que pongas en cada cuenta abajo.
        </Card.Description>
      </Card.Header>
      <Card.Content>
        <div className="flex items-center gap-2 rounded-lg bg-default-100 p-2">
          <code className="flex-1 truncate px-2 font-mono text-xs">{url}</code>
          <Button size="sm" variant={copied ? "secondary" : "outline"} onPress={copy}>
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? "Copiado" : "Copiar"}
          </Button>
        </div>
      </Card.Content>
    </Card>
  );
}

function AccountCard({ acc }: { acc: AccountSummary }) {
  const validate = useValidateAccount();
  const syncPhones = useSyncPhones();
  const syncTpl = useSyncTemplates();
  const del = useDeleteAccount();
  const [credsOpen, setCredsOpen] = useState(false);
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [toolsPhone, setToolsPhone] = useState<{ id: number; display: string } | null>(null);

  const validateResult = validate.data;

  return (
    <Card>
      <Card.Header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <Card.Title className="truncate">{acc.displayName ?? acc.wabaId}</Card.Title>
          <Card.Description>
            <span className="font-mono text-xs">WABA {acc.wabaId}</span>
          </Card.Description>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Chip size="sm" color={acc.hasToken ? "success" : "danger"} variant="soft">
            <KeyRound size={12} />
            <Chip.Label>Token {acc.hasToken ? "✓" : "✗"}</Chip.Label>
          </Chip>
          <Chip size="sm" color={acc.hasAppSecret ? "success" : "danger"} variant="soft">
            <ShieldCheck size={12} />
            <Chip.Label>Secret {acc.hasAppSecret ? "✓" : "✗"}</Chip.Label>
          </Chip>
          <Chip size="sm" color={acc.hasVerifyToken ? "success" : "danger"} variant="soft">
            <Tag size={12} />
            <Chip.Label>Verify {acc.hasVerifyToken ? "✓" : "✗"}</Chip.Label>
          </Chip>
        </div>
      </Card.Header>

      <Card.Content className="space-y-4">
        {validateResult && (
          <div
            className={`rounded-lg p-3 text-sm ${
              validateResult.ok ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
            }`}
          >
            {validateResult.ok
              ? `OK · ${validateResult.phoneNumbersFound} números · ${validateResult.templatesFound} plantillas`
              : `Error: ${validateResult.error}`}
          </div>
        )}

        <div>
          <div className="mb-2 flex items-center justify-between">
            <h4 className="flex items-center gap-1.5 font-medium text-sm">
              <Phone size={14} /> Números ({acc.phoneNumbers.length})
            </h4>
            <Button size="sm" variant="outline" onPress={() => setPhoneOpen(true)}>
              <Plus size={14} />
              Agregar manual
            </Button>
          </div>
          {acc.phoneNumbers.length === 0 ? (
            <p className="rounded-lg bg-default-100 p-3 text-default-500 text-sm">
              Sin números. Click "Sincronizar números" o agrégalos manualmente.
            </p>
          ) : (
            <ul className="space-y-2">
              {acc.phoneNumbers.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-3 rounded-lg bg-default-100 px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-sm">{p.displayPhoneNumber}</p>
                    <p className="truncate text-default-500 text-xs">
                      {p.label ?? "Sin etiqueta"} · ID {p.phoneNumberId}
                    </p>
                  </div>
                  {p.qualityRating && (
                    <Chip
                      size="sm"
                      color={QUALITY_COLOR[p.qualityRating] ?? "default"}
                      variant="soft"
                    >
                      <Chip.Label>{p.qualityRating}</Chip.Label>
                    </Chip>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    isIconOnly
                    aria-label="Herramientas del número"
                    onPress={() => setToolsPhone({ id: p.id, display: p.displayPhoneNumber })}
                  >
                    <Wrench size={14} />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card.Content>

      <Card.Footer className="flex flex-wrap gap-2 border-default-200 border-t pt-4">
        <Button
          size="sm"
          variant="secondary"
          isPending={validate.isPending}
          onPress={() => validate.mutate(acc.id)}
        >
          <ShieldCheck size={14} />
          Validar
        </Button>
        <Button
          size="sm"
          variant="secondary"
          isPending={syncPhones.isPending}
          onPress={() => syncPhones.mutate(acc.id)}
        >
          <RefreshCw size={14} />
          Sync números
        </Button>
        <Button
          size="sm"
          variant="secondary"
          isPending={syncTpl.isPending}
          onPress={() => syncTpl.mutate(acc.id)}
        >
          <RefreshCw size={14} />
          Sync plantillas
        </Button>
        <Button size="sm" variant="outline" onPress={() => setCredsOpen(true)}>
          <KeyRound size={14} />
          Editar credenciales
        </Button>
        <div className="ml-auto">
          <Button
            size="sm"
            variant="danger-soft"
            onPress={() => setConfirmDel(true)}
            isDisabled={del.isPending}
          >
            <Trash2 size={14} />
            Eliminar
          </Button>
        </div>
      </Card.Footer>

      <CredentialsModal
        isOpen={credsOpen}
        onClose={() => setCredsOpen(false)}
        accountId={acc.id}
        wabaId={acc.wabaId}
      />
      <PhoneAddModal isOpen={phoneOpen} onClose={() => setPhoneOpen(false)} accountId={acc.id} />
      {toolsPhone && (
        <PhoneToolsModal
          isOpen={Boolean(toolsPhone)}
          onClose={() => setToolsPhone(null)}
          phoneNumberId={toolsPhone.id}
          displayPhoneNumber={toolsPhone.display}
        />
      )}
      <ConfirmDeleteModal
        isOpen={confirmDel}
        onClose={() => setConfirmDel(false)}
        title="Eliminar cuenta WABA"
        message={`¿Eliminar la cuenta ${acc.displayName ?? acc.wabaId}? Conversaciones y mensajes se conservan, pero no podrás recibir/enviar nuevos.`}
        onConfirm={async () => {
          await del.mutateAsync(acc.id);
          setConfirmDel(false);
        }}
        isPending={del.isPending}
      />
    </Card>
  );
}

function CredentialsModal({
  isOpen,
  onClose,
  accountId,
  wabaId,
}: {
  isOpen: boolean;
  onClose: () => void;
  accountId: number;
  wabaId: string;
}) {
  const upsert = useUpsertAccount();
  const upPhone = useUpsertPhoneNumber();
  const accounts = useAccounts();
  const acc = accounts.data?.accounts.find((a) => a.id === accountId);
  const [appSecret, setAppSecret] = useState("");
  const [token, setToken] = useState("");
  const [verifyToken, setVerifyToken] = useState("");
  const [labelEdits, setLabelEdits] = useState<Record<number, string>>({});

  if (!acc) return null;

  const save = async () => {
    await upsert.mutateAsync({
      id: acc.id,
      wabaId: acc.wabaId,
      ...(appSecret ? { appSecret } : {}),
      ...(token ? { systemUserToken: token } : {}),
      ...(verifyToken ? { webhookVerifyToken: verifyToken } : {}),
    });
    setAppSecret("");
    setToken("");
    setVerifyToken("");
    toast.success("Credenciales guardadas");
    onClose();
  };

  const saveLabel = async (phoneId: number, phoneNumberId: string, displayPhoneNumber: string) => {
    await upPhone.mutateAsync({
      id: phoneId,
      accountId: acc.id,
      phoneNumberId,
      displayPhoneNumber,
      label: labelEdits[phoneId] ?? "",
    });
    toast.success("Etiqueta guardada");
  };

  return (
    <Modal>
      <Modal.Backdrop
        className="bg-black/40 backdrop-blur-[2px]"
        isOpen={isOpen}
        onOpenChange={(o) => !o && onClose()}
      >
        <Modal.Container placement="center">
          <Modal.Dialog className="relative w-full max-w-xl rounded-[28px] bg-background p-6 shadow-2xl">
            <Modal.Header className="mb-4">
              <Modal.Heading className="font-bold text-primary text-xl">
                Editar credenciales
              </Modal.Heading>
              <p className="text-default-500 text-sm">WABA {wabaId}</p>
            </Modal.Header>
            <Modal.Body className="max-h-[70vh] space-y-4 overflow-y-auto">
              <p className="rounded-lg bg-default-100 p-3 text-default-600 text-xs">
                Deja vacío cualquier campo que no quieras modificar. Los valores actuales se
                mantienen.
              </p>
              <TextInput
                label="App Secret"
                value={appSecret}
                onValueChange={setAppSecret}
                placeholder="••••••••"
              />
              <TextInput
                label="System User Token (Access Token)"
                value={token}
                onValueChange={setToken}
                placeholder="EAAG..."
              />
              <TextInput
                label="Webhook Verify Token"
                value={verifyToken}
                onValueChange={setVerifyToken}
                placeholder="bioalergia-..."
              />

              {acc.phoneNumbers.length > 0 && (
                <div className="space-y-2 border-default-200 border-t pt-4">
                  <h4 className="font-medium text-sm">Etiquetas de números</h4>
                  {acc.phoneNumbers.map((p) => (
                    <div key={p.id} className="flex items-end gap-2">
                      <div className="flex-1">
                        <p className="font-mono text-default-500 text-xs">{p.displayPhoneNumber}</p>
                        <TextInput
                          value={labelEdits[p.id] ?? p.label ?? ""}
                          onValueChange={(v) => setLabelEdits((m) => ({ ...m, [p.id]: v }))}
                          placeholder="Recepción / Doctor / Sandbox"
                        />
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        onPress={() => saveLabel(p.id, p.phoneNumberId, p.displayPhoneNumber)}
                      >
                        Guardar
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </Modal.Body>
            <Modal.Footer className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onPress={onClose}>
                <X size={14} />
                Cancelar
              </Button>
              <Button onPress={save} isPending={upsert.isPending}>
                <Check size={14} />
                Guardar credenciales
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

function PhoneAddModal({
  isOpen,
  onClose,
  accountId,
}: {
  isOpen: boolean;
  onClose: () => void;
  accountId: number;
}) {
  const upPhone = useUpsertPhoneNumber();
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [displayPhone, setDisplayPhone] = useState("");
  const [label, setLabel] = useState("");

  const save = async () => {
    if (!phoneNumberId || !displayPhone) return;
    await upPhone.mutateAsync({
      accountId,
      phoneNumberId,
      displayPhoneNumber: displayPhone,
      label: label || undefined,
    });
    setPhoneNumberId("");
    setDisplayPhone("");
    setLabel("");
    toast.success("Número agregado");
    onClose();
  };

  return (
    <Modal>
      <Modal.Backdrop
        className="bg-black/40 backdrop-blur-[2px]"
        isOpen={isOpen}
        onOpenChange={(o) => !o && onClose()}
      >
        <Modal.Container placement="center">
          <Modal.Dialog className="relative w-full max-w-md rounded-[28px] bg-background p-6 shadow-2xl">
            <Modal.Header className="mb-4">
              <Modal.Heading className="font-bold text-primary text-xl">
                Agregar número manual
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body className="space-y-3">
              <p className="rounded-lg bg-default-100 p-3 text-default-600 text-xs">
                Útil cuando el token no tiene scope <code>whatsapp_business_management</code> para
                listar automáticamente. Pega los IDs desde Meta dashboard.
              </p>
              <TextInput
                label="Phone Number ID"
                required
                value={phoneNumberId}
                onValueChange={setPhoneNumberId}
                placeholder="ej: 1084868904714116"
              />
              <TextInput
                label="Display Phone Number"
                required
                value={displayPhone}
                onValueChange={setDisplayPhone}
                placeholder="ej: +56 9 5102 9636"
              />
              <TextInput
                label="Etiqueta (opcional)"
                value={label}
                onValueChange={setLabel}
                placeholder="Recepción / Doctor / Sandbox"
              />
            </Modal.Body>
            <Modal.Footer className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onPress={onClose}>
                Cancelar
              </Button>
              <Button
                onPress={save}
                isPending={upPhone.isPending}
                isDisabled={!phoneNumberId || !displayPhone}
              >
                Agregar
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

function CreateAccountModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const upsert = useUpsertAccount();
  const [draft, setDraft] = useState({
    wabaId: "",
    metaBusinessId: "",
    appId: "",
    appSecret: "",
    systemUserToken: "",
    webhookVerifyToken: "",
    displayName: "",
  });

  const reset = () =>
    setDraft({
      wabaId: "",
      metaBusinessId: "",
      appId: "",
      appSecret: "",
      systemUserToken: "",
      webhookVerifyToken: "",
      displayName: "",
    });

  const save = async () => {
    if (!draft.wabaId) return;
    await upsert.mutateAsync(draft);
    reset();
    toast.success("Cuenta creada");
    onClose();
  };

  return (
    <Modal>
      <Modal.Backdrop
        className="bg-black/40 backdrop-blur-[2px]"
        isOpen={isOpen}
        onOpenChange={(o) => !o && onClose()}
      >
        <Modal.Container placement="center">
          <Modal.Dialog className="relative w-full max-w-2xl rounded-[28px] bg-background p-6 shadow-2xl">
            <Modal.Header className="mb-4">
              <Modal.Heading className="font-bold text-primary text-xl">
                Nueva cuenta WABA
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body className="grid max-h-[70vh] grid-cols-1 gap-3 overflow-y-auto md:grid-cols-2">
              <TextInput
                label="WABA ID"
                required
                value={draft.wabaId}
                onValueChange={(v) => setDraft((d) => ({ ...d, wabaId: v }))}
              />
              <TextInput
                label="Nombre interno"
                value={draft.displayName}
                onValueChange={(v) => setDraft((d) => ({ ...d, displayName: v }))}
              />
              <TextInput
                label="Meta Business ID"
                value={draft.metaBusinessId}
                onValueChange={(v) => setDraft((d) => ({ ...d, metaBusinessId: v }))}
              />
              <TextInput
                label="App ID"
                value={draft.appId}
                onValueChange={(v) => setDraft((d) => ({ ...d, appId: v }))}
              />
              <TextInput
                label="App Secret"
                value={draft.appSecret}
                onValueChange={(v) => setDraft((d) => ({ ...d, appSecret: v }))}
              />
              <TextInput
                label="System User Token"
                value={draft.systemUserToken}
                onValueChange={(v) => setDraft((d) => ({ ...d, systemUserToken: v }))}
              />
              <div className="md:col-span-2">
                <TextInput
                  label="Webhook Verify Token"
                  value={draft.webhookVerifyToken}
                  onValueChange={(v) => setDraft((d) => ({ ...d, webhookVerifyToken: v }))}
                  placeholder="Define un string secreto, lo pegarás también en Meta"
                />
              </div>
            </Modal.Body>
            <Modal.Footer className="mt-4 flex justify-end gap-2">
              <Button
                variant="outline"
                onPress={() => {
                  reset();
                  onClose();
                }}
              >
                Cancelar
              </Button>
              <Button onPress={save} isPending={upsert.isPending} isDisabled={!draft.wabaId}>
                <Plus size={14} />
                Crear cuenta
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

function ConfirmDeleteModal({
  isOpen,
  onClose,
  title,
  message,
  onConfirm,
  isPending,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  onConfirm: () => Promise<void> | void;
  isPending: boolean;
}) {
  return (
    <Modal>
      <Modal.Backdrop
        className="bg-black/40 backdrop-blur-[2px]"
        isOpen={isOpen}
        onOpenChange={(o) => !o && onClose()}
      >
        <Modal.Container placement="center">
          <Modal.Dialog className="relative w-full max-w-md rounded-[28px] bg-background p-6 shadow-2xl">
            <Modal.Header className="mb-3">
              <Modal.Heading className="font-bold text-danger text-xl">{title}</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <p className="text-default-700 text-sm">{message}</p>
            </Modal.Body>
            <Modal.Footer className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onPress={onClose}>
                Cancelar
              </Button>
              <Button variant="danger" onPress={() => void onConfirm()} isPending={isPending}>
                <Trash2 size={14} />
                Eliminar
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
