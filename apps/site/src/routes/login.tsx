import { Alert, Breadcrumbs, Button, Card, Input, Label, TextField } from "@heroui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { ShopShell } from "@/components/ShopShell";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { ctaClass } from "@/components/ui/cta";
import { accountKeys } from "@/features/account/queries";
import { siteAuthClient } from "@/lib/orpc-client";
import { isEmail } from "@/lib/validation";

function LoginPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const magicLinkMutation = useMutation({
    mutationFn: () => siteAuthClient.requestMagicLink({ email }),
    onSuccess: () => {
      setMagicLinkSent(true);
      setError(null);
    },
    onError: (err) => setError(err instanceof Error ? err.message : "No se pudo enviar el enlace"),
  });

  const passwordMutation = useMutation({
    mutationFn: () => siteAuthClient.loginWithPassword({ email, password }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: accountKeys.all });
      navigate({ to: "/mi-cuenta" });
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Credenciales incorrectas"),
  });

  const passkeyMutation = useMutation({
    mutationFn: async () => {
      const options = await siteAuthClient.passkeyLoginOptions();
      const credential = (await navigator.credentials.get({
        publicKey: options.options as PublicKeyCredentialRequestOptions,
      })) as PublicKeyCredential | null;
      if (!credential) throw new Error("Cancelado");
      const opts = options.options as { challenge: string };
      return siteAuthClient.passkeyLoginVerify({
        challenge: opts.challenge,
        body: credential,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: accountKeys.all });
      navigate({ to: "/mi-cuenta" });
    },
    onError: (err) =>
      setError(err instanceof Error ? err.message : "No se pudo verificar la passkey"),
  });

  const canSubmit = isEmail(email);
  const passkeyAvailable = typeof window !== "undefined" && Boolean(window.PublicKeyCredential);

  function onContinue() {
    setError(null);
    if (password.length >= 8) {
      passwordMutation.mutate();
    } else {
      magicLinkMutation.mutate();
    }
  }

  return (
    <ShopShell>
      <main className="mx-auto max-w-md space-y-6 px-4 py-12 sm:px-6">
        <Breadcrumbs>
          <Breadcrumbs.Item href="/">Inicio</Breadcrumbs.Item>
          <Breadcrumbs.Item>Iniciar sesión</Breadcrumbs.Item>
        </Breadcrumbs>

        <header className="grid gap-3">
          <Eyebrow>Mi cuenta</Eyebrow>
          <h1 className="font-display text-[2.5rem] leading-[1.04] text-foreground">
            Inicia sesión
          </h1>
          <p className="text-[1.0625rem] leading-[1.6] text-muted">
            Accede con tu correo. Si no tienes contraseña, te enviaremos un enlace mágico.
          </p>
        </header>

        {magicLinkSent ? (
          <Alert status="success">
            <Alert.Content>
              <Alert.Title>Revisa tu correo</Alert.Title>
              <Alert.Description>
                Te enviamos un enlace de acceso a {email}. Es válido por 15 minutos.
              </Alert.Description>
            </Alert.Content>
          </Alert>
        ) : (
          <Card className="rounded-2xl border-line bg-surface">
            <Card.Content className="space-y-4">
              <TextField onChange={setEmail} value={email}>
                <Label>Email</Label>
                <Input type="email" placeholder="tu@email.cl" autoComplete="email" />
              </TextField>
              <TextField onChange={setPassword} value={password}>
                <Label>Contraseña (opcional)</Label>
                <Input
                  type="password"
                  placeholder="Déjalo vacío para recibir un enlace mágico"
                  autoComplete="current-password"
                />
              </TextField>
              {error && (
                <Alert status="danger">
                  <Alert.Content>
                    <Alert.Description>{error}</Alert.Description>
                  </Alert.Content>
                </Alert>
              )}
              <Button
                className={ctaClass("primary", "w-full")}
                isDisabled={!canSubmit || magicLinkMutation.isPending || passwordMutation.isPending}
                onPress={onContinue}
              >
                {password.length >= 8 ? "Iniciar sesión" : "Enviarme un enlace mágico"}
              </Button>
              {passkeyAvailable && (
                <Button
                  className={ctaClass("outline", "w-full")}
                  isDisabled={passkeyMutation.isPending}
                  onPress={() => passkeyMutation.mutate()}
                >
                  Usar passkey
                </Button>
              )}
              <p className="text-muted text-sm">
                ¿No tienes cuenta?{" "}
                <Link className="font-semibold text-brand-blue hover:underline" to="/registro">
                  Regístrate
                </Link>
              </p>
            </Card.Content>
          </Card>
        )}
      </main>
    </ShopShell>
  );
}

export const Route = createFileRoute("/login")({
  component: LoginPage,
});
