import { Alert, Button, Card, Input, Label, Skeleton, TextField } from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { accountKeys } from "@/features/account/queries";
import { siteAuthClient } from "@/lib/orpc-client";

function MiCuentaSecurity() {
  const queryClient = useQueryClient();
  const meQuery = useQuery(accountKeys.me());
  const passkeysQuery = useQuery(accountKeys.passkeys());

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwOk, setPwOk] = useState(false);

  const setPassword = useMutation({
    mutationFn: () =>
      siteAuthClient.setPassword({
        ...(meQuery.data?.user?.has_password ? { currentPassword } : {}),
        newPassword,
      }),
    onSuccess: async () => {
      setCurrentPassword("");
      setNewPassword("");
      setPwError(null);
      setPwOk(true);
      await queryClient.invalidateQueries({ queryKey: accountKeys.me().queryKey });
    },
    onError: (err) =>
      setPwError(err instanceof Error ? err.message : "No se pudo cambiar la contraseña"),
  });

  const addPasskey = useMutation({
    mutationFn: async () => {
      const opts = await siteAuthClient.passkeyRegisterOptions();
      const credential = (await navigator.credentials.create({
        publicKey: opts.options as PublicKeyCredentialCreationOptions,
      })) as PublicKeyCredential | null;
      if (!credential) throw new Error("Cancelado");
      const challenge = (opts.options as { challenge: string }).challenge;
      return siteAuthClient.passkeyRegisterVerify({
        challenge,
        body: credential,
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: accountKeys.passkeys().queryKey }),
  });

  const removePasskey = useMutation({
    mutationFn: (id: string) => siteAuthClient.passkeyDelete({ passkey_id: id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: accountKeys.passkeys().queryKey }),
  });

  if (meQuery.isLoading) return <Skeleton className="h-32 w-full" />;
  const me = meQuery.data?.user;
  if (!me) return null;

  const passkeyAvailable = typeof window !== "undefined" && Boolean(window.PublicKeyCredential);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-bold text-2xl">Seguridad</h1>
      </header>

      <Card>
        <Card.Header>
          <Card.Title>Contraseña</Card.Title>
        </Card.Header>
        <Card.Content className="space-y-3">
          {me.has_password && (
            <TextField onChange={setCurrentPassword} value={currentPassword}>
              <Label>Contraseña actual</Label>
              <Input type="password" autoComplete="current-password" />
            </TextField>
          )}
          <TextField onChange={setNewPassword} value={newPassword}>
            <Label>{me.has_password ? "Nueva contraseña" : "Definir contraseña"}</Label>
            <Input type="password" placeholder="Mínimo 8 caracteres" autoComplete="new-password" />
          </TextField>
          {pwError && (
            <Alert status="danger">
              <Alert.Content>
                <Alert.Description>{pwError}</Alert.Description>
              </Alert.Content>
            </Alert>
          )}
          {pwOk && (
            <Alert status="success">
              <Alert.Content>
                <Alert.Description>Contraseña actualizada.</Alert.Description>
              </Alert.Content>
            </Alert>
          )}
          <Button
            isDisabled={setPassword.isPending || newPassword.length < 8}
            onPress={() => setPassword.mutate()}
            variant="primary"
          >
            Guardar contraseña
          </Button>
        </Card.Content>
      </Card>

      <Card>
        <Card.Header>
          <Card.Title>Passkeys</Card.Title>
        </Card.Header>
        <Card.Content className="space-y-3">
          {!passkeyAvailable && (
            <Alert status="warning">
              <Alert.Content>
                <Alert.Description>Este navegador no soporta passkeys.</Alert.Description>
              </Alert.Content>
            </Alert>
          )}
          {passkeysQuery.data?.data.length === 0 && (
            <p className="text-default-500 text-sm">Aún no has registrado passkeys.</p>
          )}
          <ul className="space-y-2">
            {passkeysQuery.data?.data.map((pk) => (
              <li
                key={pk.id}
                className="flex items-center justify-between rounded border border-default-200 p-3"
              >
                <div>
                  <p className="text-sm">{pk.friendly_name}</p>
                  <p className="text-default-500 text-xs">
                    Creada {new Date(pk.created_at).toLocaleDateString("es-CL")}
                    {pk.last_used_at &&
                      ` · Último uso ${new Date(pk.last_used_at).toLocaleDateString("es-CL")}`}
                  </p>
                </div>
                <Button
                  isDisabled={removePasskey.isPending}
                  onPress={() => removePasskey.mutate(pk.id)}
                  size="sm"
                  variant="ghost"
                >
                  Eliminar
                </Button>
              </li>
            ))}
          </ul>
          {addPasskey.isError && (
            <Alert status="danger">
              <Alert.Content>
                <Alert.Description>
                  {addPasskey.error instanceof Error
                    ? addPasskey.error.message
                    : "No se pudo registrar la passkey"}
                </Alert.Description>
              </Alert.Content>
            </Alert>
          )}
          {passkeyAvailable && (
            <Button
              isDisabled={addPasskey.isPending}
              onPress={() => addPasskey.mutate()}
              variant="secondary"
            >
              Agregar passkey
            </Button>
          )}
        </Card.Content>
      </Card>
    </div>
  );
}

export const Route = createFileRoute("/mi-cuenta/seguridad")({
  component: MiCuentaSecurity,
});
