import { Button, Card, FieldError, Input, Label, TextField } from "@heroui/react";
import { Link } from "@tanstack/react-router";
import { Mail } from "lucide-react";
import { useState } from "react";
import { requestPasswordReset } from "../api";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    setPending(true);
    try {
      await requestPasswordReset(email.trim());
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al solicitar el restablecimiento");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-default-50 p-4">
      <Card className="w-full max-w-sm border-none shadow-md">
        <Card.Header>
          <h1 className="flex items-center gap-2 text-lg font-semibold text-primary">
            <Mail size={18} /> Restablecer contraseña
          </h1>
        </Card.Header>
        <Card.Content className="space-y-4 p-5">
          {sent ? (
            <div className="space-y-3 text-sm">
              <p>
                Si el correo está registrado, te enviamos un enlace para restablecer tu contraseña.
              </p>
              <p className="text-foreground-400 text-xs">
                Revisa también spam. El enlace vence en 1 hora.
              </p>
              <Link to="/login" className="text-primary text-sm">
                Volver al inicio de sesión
              </Link>
            </div>
          ) : (
            <>
              <p className="text-foreground-500 text-sm">
                Ingresa tu correo y te enviaremos un enlace para crear una nueva contraseña.
              </p>
              <TextField value={email} onChange={setEmail} type="email" isInvalid={Boolean(error)}>
                <Label>Correo</Label>
                <Input placeholder="tucorreo@bioalergia.cl" />
                {error ? <FieldError>{error}</FieldError> : null}
              </TextField>
              <Button
                variant="primary"
                className="w-full"
                isDisabled={!email.trim() || pending}
                onPress={() => void handleSubmit()}
              >
                {pending ? "Enviando…" : "Enviar enlace"}
              </Button>
              <Link to="/login" className="block text-center text-primary text-sm">
                Volver al inicio de sesión
              </Link>
            </>
          )}
        </Card.Content>
      </Card>
    </div>
  );
}
