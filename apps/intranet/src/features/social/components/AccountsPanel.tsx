import { Button, Chip, Form, Label, ListBox, Select, Switch } from "@heroui/react";
import { useForm } from "@tanstack/react-form";
import { PlugZap, Sparkles } from "lucide-react";

import { TanStackInputField } from "@/components/forms/TanStackFieldControls";
import { confirmAction } from "@/components/ui/ConfirmDialog";
import { PageState } from "@/components/ui/PageState";
import { useToast } from "@/context/ToastContext";
import { formatChile } from "@/lib/dates";
import {
  useAiConfig,
  useConnectAccount,
  useMetaConfig,
  useSocialAccounts,
  useSocialSettings,
  useTiktokConfig,
  useUpdateAiConfig,
  useUpdateMetaConfig,
  useUpdateSocialSettings,
  useUpdateTiktokConfig,
} from "../queries";

type AiProvider = "GEMINI" | "RECRAFT";

interface AiConfigFormState {
  provider: AiProvider;
  geminiApiKey: string;
  recraftApiKey: string;
}

interface MetaConfigFormState {
  appId: string;
  appSecret: string;
  configId: string;
  graphVersion: string;
}

interface TiktokConfigFormState {
  clientKey: string;
  clientSecret: string;
}

interface ConnectFormState {
  displayName: string;
  appId: string;
  appSecret: string;
  shortLivedToken: string;
  igUserId: string;
  fbPageId: string;
}

export function AccountsPanel() {
  const toast = useToast();
  const accountsQuery = useSocialAccounts();
  const connectMutation = useConnectAccount();
  const settingsQuery = useSocialSettings();
  const updateSettings = useUpdateSocialSettings();
  const metaConfigQuery = useMetaConfig();
  const updateMetaConfig = useUpdateMetaConfig();
  const tiktokConfigQuery = useTiktokConfig();
  const updateTiktokConfig = useUpdateTiktokConfig();
  const aiConfigQuery = useAiConfig();
  const updateAiConfig = useUpdateAiConfig();

  const dryRun = settingsQuery.data?.dryRun ?? true;
  const metaConfig = metaConfigQuery.data;
  const metaReady = !!metaConfig?.appId && !!metaConfig?.configId && !!metaConfig?.hasSecret;
  const tiktokConfig = tiktokConfigQuery.data;
  const tiktokReady = !!tiktokConfig?.clientKey && !!tiktokConfig?.hasSecret;
  const aiConfig = aiConfigQuery.data;

  const metaForm = useForm({
    defaultValues: {
      appId: "",
      appSecret: "",
      configId: "",
      graphVersion: "v23.0",
    } as MetaConfigFormState,
    onSubmit: async ({ value }) => {
      try {
        await updateMetaConfig.mutateAsync({
          appId: value.appId.trim(),
          configId: value.configId.trim(),
          ...(value.appSecret.trim() ? { appSecret: value.appSecret.trim() } : {}),
          ...(value.graphVersion.trim() ? { graphVersion: value.graphVersion.trim() } : {}),
        });
        toast.success("Configuración Meta guardada");
        metaForm.reset();
      } catch (error) {
        toast.error(error, "No se pudo guardar la configuración");
      }
    },
  });

  const tiktokForm = useForm({
    defaultValues: {
      clientKey: "",
      clientSecret: "",
    } as TiktokConfigFormState,
    onSubmit: async ({ value }) => {
      try {
        await updateTiktokConfig.mutateAsync({
          clientKey: value.clientKey.trim(),
          ...(value.clientSecret.trim() ? { clientSecret: value.clientSecret.trim() } : {}),
        });
        toast.success("Configuración TikTok guardada");
        tiktokForm.reset();
      } catch (error) {
        toast.error(error, "No se pudo guardar la configuración");
      }
    },
  });

  const aiForm = useForm({
    defaultValues: {
      provider: (aiConfig?.provider ?? "GEMINI") as AiProvider,
      geminiApiKey: "",
      recraftApiKey: "",
    } as AiConfigFormState,
    onSubmit: async ({ value }) => {
      try {
        await updateAiConfig.mutateAsync({
          provider: value.provider,
          ...(value.geminiApiKey.trim() ? { geminiApiKey: value.geminiApiKey.trim() } : {}),
          ...(value.recraftApiKey.trim() ? { recraftApiKey: value.recraftApiKey.trim() } : {}),
        });
        toast.success("Configuración IA guardada");
        aiForm.reset();
      } catch (error) {
        toast.error(error, "No se pudo guardar la configuración IA");
      }
    },
  });

  const handleToggleReal = async (realMode: boolean) => {
    if (realMode) {
      const ok = await confirmAction({
        title: "Activar publicación real",
        description:
          "Las publicaciones aprobadas se enviarán de verdad a Meta (Instagram/Facebook). Asegúrate de tener una cuenta conectada y el App Review aprobado.",
        confirmLabel: "Activar publicación real",
        variant: "danger",
      });
      if (!ok) return;
    }
    try {
      await updateSettings.mutateAsync({ dryRun: !realMode });
      toast.success(realMode ? "Publicación real activada" : "Dry-run activado");
    } catch (error) {
      toast.error(error, "No se pudo cambiar el modo");
    }
  };

  const form = useForm({
    defaultValues: {
      displayName: "",
      appId: "",
      appSecret: "",
      shortLivedToken: "",
      igUserId: "",
      fbPageId: "",
    } as ConnectFormState,
    onSubmit: async ({ value }) => {
      const ok = await confirmAction({
        title: "Conectar cuenta de Meta",
        description:
          "Se intercambiará el token de corta duración por uno de larga duración y se guardará la cuenta.",
        confirmLabel: "Conectar",
      });
      if (!ok) return;
      try {
        await connectMutation.mutateAsync({
          appId: value.appId.trim(),
          appSecret: value.appSecret.trim(),
          shortLivedToken: value.shortLivedToken.trim(),
          ...(value.displayName.trim() ? { displayName: value.displayName.trim() } : {}),
          ...(value.igUserId.trim() ? { igUserId: value.igUserId.trim() } : {}),
          ...(value.fbPageId.trim() ? { fbPageId: value.fbPageId.trim() } : {}),
        });
        toast.success("Cuenta conectada");
        form.reset();
      } catch (error) {
        toast.error(error, "No se pudo conectar la cuenta");
      }
    },
  });

  const isPending = connectMutation.isPending;

  return (
    <div className="space-y-6">
      <section className="flex items-start justify-between gap-4 rounded-xl border border-divider p-4">
        <div className="space-y-1">
          <h3 className="font-semibold text-foreground text-sm">Modo de publicación</h3>
          <p className="text-default-500 text-xs">
            {dryRun
              ? "Dry-run: las aprobaciones se simulan, no se publica a Meta."
              : "Real: las aprobaciones se publican en Instagram/Facebook."}
          </p>
        </div>
        <Switch
          isSelected={!dryRun}
          isDisabled={settingsQuery.isLoading || updateSettings.isPending}
          onChange={(realMode) => void handleToggleReal(realMode)}
        >
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
          <Switch.Content>Publicación real</Switch.Content>
        </Switch>
      </section>

      <section className="space-y-3 rounded-xl border border-divider p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1">
            <h3 className="font-semibold text-foreground text-sm">Conexión con Meta (OAuth)</h3>
            <p className="text-default-500 text-xs">
              {metaReady
                ? "App Meta configurada. Conecta una cuenta con el flujo oficial de Meta."
                : "Configura el App ID, App Secret y config_id de la app de Meta para habilitar el OAuth."}
            </p>
          </div>
          <Button
            isDisabled={!metaReady}
            variant="primary"
            onPress={() => {
              window.location.href = "/api/social/oauth/start";
            }}
          >
            <PlugZap size={16} /> Conectar con Meta
          </Button>
        </div>
        <Form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e: React.FormEvent<HTMLFormElement>) => {
            e.preventDefault();
            e.stopPropagation();
            void metaForm.handleSubmit();
          }}
          validationBehavior="aria"
        >
          <metaForm.Field
            name="appId"
            validators={{ onBlur: ({ value }) => (value.trim() ? undefined : "App ID requerido") }}
          >
            {(field) => (
              <TanStackInputField
                field={field}
                label="App ID"
                placeholder={metaConfig?.appId ?? ""}
                required
              />
            )}
          </metaForm.Field>
          <metaForm.Field
            name="configId"
            validators={{
              onBlur: ({ value }) => (value.trim() ? undefined : "config_id requerido"),
            }}
          >
            {(field) => (
              <TanStackInputField
                field={field}
                label="config_id (Login for Business)"
                placeholder={metaConfig?.configId ?? ""}
                required
              />
            )}
          </metaForm.Field>
          <metaForm.Field name="appSecret">
            {(field) => (
              <TanStackInputField
                field={field}
                label={
                  metaConfig?.hasSecret ? "App Secret (dejar vacío = conservar)" : "App Secret"
                }
                type="password"
              />
            )}
          </metaForm.Field>
          <metaForm.Field name="graphVersion">
            {(field) => (
              <TanStackInputField field={field} label="Graph version" placeholder="v23.0" />
            )}
          </metaForm.Field>
          <div className="flex justify-end pt-1 sm:col-span-2">
            <Button isPending={updateMetaConfig.isPending} type="submit" variant="outline">
              Guardar configuración Meta
            </Button>
          </div>
        </Form>
      </section>

      <section className="space-y-3 rounded-xl border border-divider p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1">
            <h3 className="font-semibold text-foreground text-sm">Conexión con TikTok (OAuth)</h3>
            <p className="text-default-500 text-xs">
              {tiktokReady
                ? "App TikTok configurada. Conecta tu cuenta con el flujo oficial de TikTok. Hasta aprobar el audit de video.publish, las publicaciones son privadas (solo tú)."
                : "Configura el Client Key y Client Secret de la app de TikTok for Developers para habilitar el OAuth."}
            </p>
          </div>
          <Button
            isDisabled={!tiktokReady}
            variant="primary"
            onPress={() => {
              window.location.href = "/api/social/tiktok/oauth/start";
            }}
          >
            <PlugZap size={16} /> Conectar con TikTok
          </Button>
        </div>
        <Form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e: React.FormEvent<HTMLFormElement>) => {
            e.preventDefault();
            e.stopPropagation();
            void tiktokForm.handleSubmit();
          }}
          validationBehavior="aria"
        >
          <tiktokForm.Field
            name="clientKey"
            validators={{
              onBlur: ({ value }) => (value.trim() ? undefined : "Client Key requerido"),
            }}
          >
            {(field) => (
              <TanStackInputField
                field={field}
                label="Client Key"
                placeholder={tiktokConfig?.clientKey ?? ""}
                required
              />
            )}
          </tiktokForm.Field>
          <tiktokForm.Field name="clientSecret">
            {(field) => (
              <TanStackInputField
                field={field}
                label={
                  tiktokConfig?.hasSecret
                    ? "Client Secret (dejar vacío = conservar)"
                    : "Client Secret"
                }
                type="password"
              />
            )}
          </tiktokForm.Field>
          <div className="flex justify-end pt-1 sm:col-span-2">
            <Button isPending={updateTiktokConfig.isPending} type="submit" variant="outline">
              Guardar configuración TikTok
            </Button>
          </div>
        </Form>
      </section>

      <section className="space-y-3 rounded-xl border border-divider p-4">
        <div className="space-y-1">
          <h3 className="flex items-center gap-2 font-semibold text-foreground text-sm">
            <Sparkles size={16} /> Configuración IA (imagen)
          </h3>
          <p className="text-default-500 text-xs">
            Genera un hero/fondo fotográfico opcional con un modelo de IA (pay-per-use; $0 si no se
            usa). El texto de marca NUNCA lo genera la IA: se compone encima con la plantilla.
            Gemini tiene un free tier de ~500 imágenes/día.
          </p>
        </div>
        <Form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e: React.FormEvent<HTMLFormElement>) => {
            e.preventDefault();
            e.stopPropagation();
            void aiForm.handleSubmit();
          }}
          validationBehavior="aria"
        >
          <aiForm.Field name="provider">
            {(field) => (
              <Select
                onChange={(val) => field.handleChange(val as AiProvider)}
                value={field.state.value}
              >
                <Label>Proveedor</Label>
                <Select.Trigger>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    <ListBox.Item id="GEMINI" key="GEMINI">
                      Gemini (Nano Banana)
                    </ListBox.Item>
                    <ListBox.Item id="RECRAFT" key="RECRAFT">
                      Recraft
                    </ListBox.Item>
                  </ListBox>
                </Select.Popover>
              </Select>
            )}
          </aiForm.Field>
          <div className="hidden sm:block" />
          <aiForm.Field name="geminiApiKey">
            {(field) => (
              <TanStackInputField
                field={field}
                label={
                  aiConfig?.hasGeminiKey
                    ? "API key Gemini (dejar vacío = conservar)"
                    : "API key Gemini"
                }
                type="password"
              />
            )}
          </aiForm.Field>
          <aiForm.Field name="recraftApiKey">
            {(field) => (
              <TanStackInputField
                field={field}
                label={
                  aiConfig?.hasRecraftKey
                    ? "API key Recraft (dejar vacío = conservar)"
                    : "API key Recraft"
                }
                type="password"
              />
            )}
          </aiForm.Field>
          <div className="flex justify-end pt-1 sm:col-span-2">
            <Button isPending={updateAiConfig.isPending} type="submit" variant="outline">
              Guardar configuración IA
            </Button>
          </div>
        </Form>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <section className="space-y-3">
          <h3 className="font-semibold text-foreground text-sm">Cuentas conectadas</h3>
          <PageState
            query={accountsQuery}
            isEmpty={(accounts) => accounts.length === 0}
            emptyTitle="Sin cuentas conectadas"
            emptyDescription="Conecta una cuenta de Meta para publicar en Instagram y Facebook."
          >
            {(accounts) => (
              <ul className="space-y-2">
                {accounts.map((account) => (
                  <li className="rounded-xl border border-divider p-3" key={account.id}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-sm">
                        {account.displayName ?? `Cuenta #${account.id}`}
                      </p>
                      <Chip color={account.active ? "success" : "default"} size="sm" variant="soft">
                        {account.active ? "Activa" : "Inactiva"}
                      </Chip>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1 text-default-500 text-xs">
                      <span>{account.provider}</span>
                      {account.igUserId ? <span>· IG {account.igUserId}</span> : null}
                      {account.fbPageId ? <span>· FB {account.fbPageId}</span> : null}
                    </div>
                    {account.tokenExpiresAt ? (
                      <p className="mt-1 text-default-400 text-xs">
                        Token expira: {formatChile(account.tokenExpiresAt, "DD/MM/YYYY HH:mm")}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </PageState>
        </section>

        <section className="space-y-3">
          <h3 className="font-semibold text-foreground text-sm">Conectar cuenta de Meta</h3>
          <Form
            className="space-y-3"
            onSubmit={(e: React.FormEvent<HTMLFormElement>) => {
              e.preventDefault();
              e.stopPropagation();
              void form.handleSubmit();
            }}
            validationBehavior="aria"
          >
            <form.Field name="displayName">
              {(field) => (
                <TanStackInputField
                  field={field}
                  label="Nombre (opcional)"
                  placeholder="Bioalergia"
                />
              )}
            </form.Field>
            <form.Field
              name="appId"
              validators={{
                onBlur: ({ value }) => (value.trim() ? undefined : "App ID requerido"),
              }}
            >
              {(field) => <TanStackInputField field={field} label="App ID" required />}
            </form.Field>
            <form.Field
              name="appSecret"
              validators={{
                onBlur: ({ value }) => (value.trim() ? undefined : "App Secret requerido"),
              }}
            >
              {(field) => (
                <TanStackInputField field={field} label="App Secret" required type="password" />
              )}
            </form.Field>
            <form.Field
              name="shortLivedToken"
              validators={{
                onBlur: ({ value }) => (value.trim() ? undefined : "Token requerido"),
              }}
            >
              {(field) => (
                <TanStackInputField
                  field={field}
                  label="Token de corta duración"
                  required
                  type="password"
                />
              )}
            </form.Field>
            <form.Field name="igUserId">
              {(field) => <TanStackInputField field={field} label="IG User ID (opcional)" />}
            </form.Field>
            <form.Field name="fbPageId">
              {(field) => <TanStackInputField field={field} label="FB Page ID (opcional)" />}
            </form.Field>
            <div className="flex justify-end pt-1">
              <Button isPending={isPending} type="submit" variant="primary">
                <PlugZap size={16} /> Conectar
              </Button>
            </div>
          </Form>
        </section>
      </div>
    </div>
  );
}
