import { Button, Card, Chip, Spinner } from "@heroui/react";
import { useState } from "react";
import { TextInput } from "@/features/outreach/components/FormField";
import {
  useAccounts,
  useDeleteAccount,
  useSyncPhones,
  useSyncTemplates,
  useUpsertAccount,
  useUpsertPhoneNumber,
  useValidateAccount,
} from "../hooks/useWaCloud";

export function WaCloudSettingsPage() {
  const accounts = useAccounts();
  const upsert = useUpsertAccount();
  const del = useDeleteAccount();
  const validate = useValidateAccount();
  const syncPhones = useSyncPhones();
  const syncTpl = useSyncTemplates();

  const [draft, setDraft] = useState({
    wabaId: "",
    metaBusinessId: "",
    appId: "",
    appSecret: "",
    systemUserToken: "",
    webhookVerifyToken: "",
    displayName: "",
  });

  const handleCreate = async () => {
    if (!draft.wabaId) return;
    await upsert.mutateAsync(draft);
    setDraft({
      wabaId: "",
      metaBusinessId: "",
      appId: "",
      appSecret: "",
      systemUserToken: "",
      webhookVerifyToken: "",
      displayName: "",
    });
  };

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
    <div className="space-y-4 p-6">
      <Card>
        <Card.Header>
          <Card.Title>Configuración Webhook Meta</Card.Title>
          <Card.Description>
            Pega esta URL en Meta Business Manager → tu app → WhatsApp → Configuración → Webhook
            URL. Verify token = el que pongas en cada cuenta abajo.
          </Card.Description>
        </Card.Header>
        <Card.Content className="p-4">
          <code className="block rounded bg-default-100 p-3 text-xs">{webhookBase}</code>
        </Card.Content>
      </Card>

      {accounts.data.accounts.map((acc) => (
        <Card key={acc.id}>
          <Card.Header className="flex items-center justify-between">
            <div>
              <Card.Title>{acc.displayName ?? acc.wabaId}</Card.Title>
              <Card.Description>WABA ID: {acc.wabaId}</Card.Description>
            </div>
            <div className="flex flex-wrap gap-2">
              <Chip size="sm" color={acc.hasToken ? "success" : "danger"} variant="soft">
                Token {acc.hasToken ? "✓" : "✗"}
              </Chip>
              <Chip size="sm" color={acc.hasAppSecret ? "success" : "danger"} variant="soft">
                AppSecret {acc.hasAppSecret ? "✓" : "✗"}
              </Chip>
              <Chip size="sm" color={acc.hasVerifyToken ? "success" : "danger"} variant="soft">
                VerifyToken {acc.hasVerifyToken ? "✓" : "✗"}
              </Chip>
            </div>
          </Card.Header>
          <Card.Content className="space-y-3 p-4">
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                isDisabled={validate.isPending}
                onPress={() => validate.mutate(acc.id)}
              >
                {validate.isPending ? "Validando..." : "Validar credenciales"}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                isDisabled={syncPhones.isPending}
                onPress={() => syncPhones.mutate(acc.id)}
              >
                {syncPhones.isPending ? "Sincronizando..." : "Sincronizar números"}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                isDisabled={syncTpl.isPending}
                onPress={() => syncTpl.mutate(acc.id)}
              >
                {syncTpl.isPending ? "Sincronizando..." : "Sincronizar plantillas"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onPress={() => del.mutate(acc.id)}
                isDisabled={del.isPending}
              >
                Eliminar
              </Button>
            </div>
            {validate.data && (
              <div className="rounded bg-default-100 p-2 text-xs">
                {validate.data.ok ? (
                  <span className="text-success">
                    OK · {validate.data.phoneNumbersFound} números · {validate.data.templatesFound}{" "}
                    plantillas
                  </span>
                ) : (
                  <span className="text-danger">Error: {validate.data.error}</span>
                )}
              </div>
            )}
            {acc.phoneNumbers.length === 0 ? (
              <p className="text-default-500 text-sm">
                Sin números aún. Click "Sincronizar números" tras configurar token.
              </p>
            ) : (
              <ul className="space-y-1 text-sm">
                {acc.phoneNumbers.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between rounded bg-default-100 p-2"
                  >
                    <div>
                      <p className="font-medium">{p.displayPhoneNumber}</p>
                      <p className="text-default-500 text-xs">
                        {p.label ?? "Sin etiqueta"} · ID {p.phoneNumberId}
                      </p>
                    </div>
                    {p.qualityRating && (
                      <Chip size="sm" variant="soft">
                        {p.qualityRating}
                      </Chip>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <CredentialsEditor accountId={acc.id} />
          </Card.Content>
        </Card>
      ))}

      <Card>
        <Card.Header>
          <Card.Title>Agregar nueva cuenta WABA</Card.Title>
        </Card.Header>
        <Card.Content className="grid grid-cols-1 gap-2 p-4 md:grid-cols-2">
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
          <TextInput
            label="Webhook Verify Token (define tú uno)"
            value={draft.webhookVerifyToken}
            onValueChange={(v) => setDraft((d) => ({ ...d, webhookVerifyToken: v }))}
          />
          <div className="md:col-span-2">
            <Button
              variant="primary"
              isDisabled={!draft.wabaId || upsert.isPending}
              onPress={handleCreate}
            >
              {upsert.isPending ? "Guardando..." : "Crear cuenta"}
            </Button>
          </div>
        </Card.Content>
      </Card>
    </div>
  );
}

function CredentialsEditor({ accountId }: { accountId: number }) {
  const upsert = useUpsertAccount();
  const upPhone = useUpsertPhoneNumber();
  const accounts = useAccounts();
  const acc = accounts.data?.accounts.find((a) => a.id === accountId);
  const [open, setOpen] = useState(false);
  const [appSecret, setAppSecret] = useState("");
  const [token, setToken] = useState("");
  const [verifyToken, setVerifyToken] = useState("");
  const [labelEdits, setLabelEdits] = useState<Record<number, string>>({});

  if (!acc) return null;

  const handleSaveCreds = async () => {
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
    setOpen(false);
  };

  const saveLabel = async (phoneId: number, phoneNumberId: string, displayPhoneNumber: string) => {
    await upPhone.mutateAsync({
      id: phoneId,
      accountId: acc.id,
      phoneNumberId,
      displayPhoneNumber,
      label: labelEdits[phoneId] ?? "",
    });
  };

  return (
    <div>
      <Button size="sm" variant="ghost" onPress={() => setOpen((v) => !v)}>
        {open ? "Cerrar" : "Editar credenciales / etiquetas"}
      </Button>
      {open && (
        <div className="mt-3 space-y-3 rounded bg-default-50 p-3">
          <TextInput
            label="App Secret (deja vacío para mantener)"
            value={appSecret}
            onValueChange={setAppSecret}
          />
          <TextInput label="System User Token" value={token} onValueChange={setToken} />
          <TextInput
            label="Webhook Verify Token"
            value={verifyToken}
            onValueChange={setVerifyToken}
          />
          <Button variant="primary" size="sm" onPress={handleSaveCreds}>
            Guardar credenciales
          </Button>
          {acc.phoneNumbers.length > 0 && (
            <div className="space-y-2 border-default-200 border-t pt-3">
              <p className="font-medium text-sm">Etiquetas de números</p>
              {acc.phoneNumbers.map((p) => (
                <div key={p.id} className="flex items-end gap-2">
                  <span className="text-sm">{p.displayPhoneNumber}</span>
                  <TextInput
                    label="Etiqueta"
                    value={labelEdits[p.id] ?? p.label ?? ""}
                    onValueChange={(v) => setLabelEdits((m) => ({ ...m, [p.id]: v }))}
                  />
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
        </div>
      )}
    </div>
  );
}
