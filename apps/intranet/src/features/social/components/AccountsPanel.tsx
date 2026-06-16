import { Button, Chip, Form, Switch } from "@heroui/react";
import { useForm } from "@tanstack/react-form";
import { PlugZap } from "lucide-react";

import { TanStackInputField } from "@/components/forms/TanStackFieldControls";
import { confirmAction } from "@/components/ui/ConfirmDialog";
import { PageState } from "@/components/ui/PageState";
import { useToast } from "@/context/ToastContext";
import { formatChile } from "@/lib/dates";
import {
  useConnectAccount,
  useSocialAccounts,
  useSocialSettings,
  useUpdateSocialSettings,
} from "../queries";

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

  const dryRun = settingsQuery.data?.dryRun ?? true;

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
