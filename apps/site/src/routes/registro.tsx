import { Alert, Breadcrumbs, Button, Card, Checkbox, Input, Label, TextField } from "@heroui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { accountKeys } from "@/features/account/queries";
import { siteAuthClient } from "@/lib/orpc-client";

function RegistroPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [rut, setRut] = useState("");
  const [password, setPassword] = useState("");
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const registerMutation = useMutation({
    mutationFn: () =>
      siteAuthClient.registerWithPassword({
        email,
        name,
        password,
        ...(rut ? { rut } : {}),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: accountKeys.all });
      navigate({ to: "/mi-cuenta" });
    },
    onError: (err) => setError(err instanceof Error ? err.message : "No se pudo registrar"),
  });

  const magicLinkMutation = useMutation({
    mutationFn: () => siteAuthClient.requestMagicLink({ email, ...(name ? { name } : {}) }),
    onSuccess: () => setError(null),
    onError: (err) => setError(err instanceof Error ? err.message : "No se pudo enviar el enlace"),
  });

  const usePassword = password.length > 0;
  const canSubmit =
    email.includes("@") && name.length >= 2 && terms && (!usePassword || password.length >= 8);

  return (
    <main className="mx-auto max-w-md space-y-6 px-4 py-8 sm:px-6">
      <Breadcrumbs>
        <Breadcrumbs.Item href="/">Inicio</Breadcrumbs.Item>
        <Breadcrumbs.Item>Crear cuenta</Breadcrumbs.Item>
      </Breadcrumbs>

      <header className="space-y-1">
        <h1 className="font-bold text-3xl">Crear cuenta</h1>
        <p className="text-default-500 text-sm">
          Crea tu cuenta para hacer seguimiento a tus pedidos. La contraseña es opcional — puedes
          acceder con enlace mágico.
        </p>
      </header>

      <Card>
        <Card.Content className="space-y-4">
          <TextField onChange={setEmail} value={email}>
            <Label>Email</Label>
            <Input type="email" placeholder="tu@email.cl" autoComplete="email" />
          </TextField>
          <TextField onChange={setName} value={name}>
            <Label>Nombre completo</Label>
            <Input autoComplete="name" />
          </TextField>
          <TextField onChange={setRut} value={rut}>
            <Label>RUT (opcional, solo si quieres factura)</Label>
            <Input placeholder="12.345.678-9" />
          </TextField>
          <TextField onChange={setPassword} value={password}>
            <Label>Contraseña (opcional)</Label>
            <Input type="password" placeholder="Mínimo 8 caracteres" autoComplete="new-password" />
          </TextField>
          <Checkbox isSelected={terms} onChange={setTerms}>
            Acepto los{" "}
            <Link className="underline" to="/legal/$slug" params={{ slug: "terms" }}>
              términos
            </Link>{" "}
            y{" "}
            <Link className="underline" to="/legal/$slug" params={{ slug: "privacy" }}>
              política de privacidad
            </Link>
            .
          </Checkbox>
          {error && (
            <Alert status="danger">
              <Alert.Content>
                <Alert.Description>{error}</Alert.Description>
              </Alert.Content>
            </Alert>
          )}
          <Button
            isDisabled={!canSubmit || registerMutation.isPending || magicLinkMutation.isPending}
            onPress={() => (usePassword ? registerMutation.mutate() : magicLinkMutation.mutate())}
            variant="primary"
          >
            {usePassword ? "Crear cuenta" : "Enviarme un enlace mágico"}
          </Button>
          {!usePassword && magicLinkMutation.isSuccess && (
            <Alert status="success">
              <Alert.Content>
                <Alert.Description>
                  Te enviamos un enlace de acceso a {email}. Es válido por 15 minutos.
                </Alert.Description>
              </Alert.Content>
            </Alert>
          )}
          <p className="text-default-500 text-sm">
            ¿Ya tienes cuenta?{" "}
            <Link className="underline" to="/login">
              Inicia sesión
            </Link>
          </p>
        </Card.Content>
      </Card>
    </main>
  );
}

export const Route = createFileRoute("/registro")({
  component: RegistroPage,
});
