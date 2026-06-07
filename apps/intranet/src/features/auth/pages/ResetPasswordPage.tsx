import { Button, Card, FieldError, Input, Label, TextField } from "@heroui/react";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { KeyRound } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/context/ToastContext";
import { resetPasswordWithToken } from "../api";

export function ResetPasswordPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const { token } = useSearch({ from: "/reset-password" });
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tooShort = password.length > 0 && password.length < 8;
  const mismatch = confirm.length > 0 && confirm !== password;
  const canSubmit = password.length >= 8 && confirm === password && Boolean(token);

  const handleSubmit = async () => {
    setError(null);
    if (!token) {
      setError("Falta el token. Usa el enlace del correo.");
      return;
    }
    setPending(true);
    try {
      await resetPasswordWithToken(token, password);
      toast.success("Contraseña actualizada. Inicia sesión.");
      await navigate({ to: "/login" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo restablecer la contraseña");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-default-50 p-4">
      <Card className="w-full max-w-sm border-none shadow-md">
        <Card.Header>
          <h1 className="flex items-center gap-2 text-lg font-semibold text-primary">
            <KeyRound size={18} /> Nueva contraseña
          </h1>
        </Card.Header>
        <Card.Content className="space-y-4 p-5">
          {!token ? (
            <div className="space-y-3 text-sm">
              <p>El enlace no es válido o está incompleto.</p>
              <Link to="/forgot-password" className="text-primary">
                Solicitar uno nuevo
              </Link>
            </div>
          ) : (
            <>
              <TextField
                value={password}
                onChange={setPassword}
                type="password"
                isInvalid={tooShort}
              >
                <Label>Nueva contraseña</Label>
                <Input placeholder="Mínimo 8 caracteres" />
                {tooShort ? <FieldError>Mínimo 8 caracteres.</FieldError> : null}
              </TextField>
              <TextField value={confirm} onChange={setConfirm} type="password" isInvalid={mismatch}>
                <Label>Confirmar contraseña</Label>
                <Input placeholder="Repite la contraseña" />
                {mismatch ? <FieldError>No coinciden.</FieldError> : null}
              </TextField>
              {error ? <p className="text-danger-600 text-sm">{error}</p> : null}
              <Button
                variant="primary"
                className="w-full"
                isDisabled={!canSubmit || pending}
                onPress={() => void handleSubmit()}
              >
                {pending ? "Guardando…" : "Cambiar contraseña"}
              </Button>
            </>
          )}
        </Card.Content>
      </Card>
    </div>
  );
}
