import { useState, useEffect } from "react";
import { startRegistration } from "@simplewebauthn/browser";
import { User, Smartphone, Fingerprint, Check, Loader2, LogOut } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { PAGE_CONTAINER } from "@/lib/styles";
import { cn } from "@/lib/utils";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/Card";
import {
  setupMfa,
  enableMfa,
  disableMfa,
  fetchPasskeyRegistrationOptions,
  verifyPasskeyRegistration,
  removePasskey,
} from "@/features/auth/api";

export default function AccountSettingsPage() {
  const { user, refreshSession, logout } = useAuth();
  const { success, error } = useToast();

  // MFA State
  const [mfaSecret, setMfaSecret] = useState<string | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [mfaToken, setMfaToken] = useState("");
  const [isMfaEnabled, setIsMfaEnabled] = useState(user?.mfaEnabled ?? false);

  useEffect(() => {
    if (user) setIsMfaEnabled(user.mfaEnabled ?? false);
  }, [user]);

  // --- MFA Mutations ---
  const setupMfaMutation = useMutation({
    mutationFn: () =>
      setupMfa().then((res) => {
        if (res.status !== "ok") throw new Error(res.message || "Error al iniciar configuración MFA");
        return res;
      }),
    onSuccess: (data) => {
      setMfaSecret(data.secret);
      setQrCodeUrl(data.qrCodeUrl);
    },
    onError: (err) => {
      error(err instanceof Error ? err.message : "Error al iniciar configuración MFA");
    },
  });

  const enableMfaMutation = useMutation({
    mutationFn: (token: string) =>
      enableMfa({ token, userId: user?.id }).then((res) => {
        if (res.status !== "ok") throw new Error(res.message || "Código incorrecto");
        return res;
      }),
    onSuccess: async () => {
      success("MFA activado correctamente");
      setIsMfaEnabled(true);
      setMfaSecret(null);
      setQrCodeUrl(null);
      await refreshSession();
    },
    onError: (err) => {
      error(err instanceof Error ? err.message : "Error al activar MFA");
    },
  });

  const disableMfaMutation = useMutation({
    mutationFn: () =>
      disableMfa().then((res) => {
        if (res.status !== "ok") throw new Error("No se pudo desactivar MFA");
        return res;
      }),
    onSuccess: async () => {
      success("MFA desactivado");
      setIsMfaEnabled(false);
      await refreshSession();
    },
    onError: () => {
      error("Error al desactivar MFA");
    },
  });

  const handleDisableMfa = () => {
    if (!confirm("¿Estás seguro de desactivar la autenticación de dos factores? Tu cuenta será menos segura.")) return;
    disableMfaMutation.mutate();
  };

  // --- Passkey Mutations ---
  const registerPasskeyMutation = useMutation({
    mutationFn: async () => {
      const options = await fetchPasskeyRegistrationOptions();
      if (options.status === "error") throw new Error(options.message);

      const attResp = await startRegistration({ optionsJSON: options });

      const verifyData = await verifyPasskeyRegistration({ body: attResp, challenge: options.challenge });
      if (verifyData.status !== "ok") throw new Error(verifyData.message || "Error al verificar passkey");

      return verifyData;
    },
    onSuccess: async () => {
      success("Passkey registrado exitosamente");
      await refreshSession();
    },
    onError: (err) => {
      console.error(err);
      error(err instanceof Error ? err.message : "Error al registrar passkey");
    },
  });

  const deletePasskeyMutation = useMutation({
    mutationFn: () =>
      removePasskey().then((res) => {
        if (res.status !== "ok") throw new Error(res.message || "Error al eliminar passkey");
        return res;
      }),
    onSuccess: async () => {
      success("Passkey eliminado");
      await refreshSession();
    },
    onError: (err) => {
      error(err instanceof Error ? err.message : "Error al eliminar passkey");
    },
  });

  const handleDeletePasskey = () => {
    if (!confirm("¿Estás seguro de eliminar tu passkey? Tendrás que usar tu contraseña para iniciar sesión.")) return;
    deletePasskeyMutation.mutate();
  };

  const displayName = user?.name || user?.email?.split("@")[0] || "Usuario";
  const hasPasskey = (user as unknown as { hasPasskey: boolean })?.hasPasskey;

  return (
    <div className={cn(PAGE_CONTAINER, "space-y-6")}>
      {/* Profile Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="text-primary size-5" />
            <CardTitle>Mi Perfil</CardTitle>
          </div>
          <CardDescription>Tu información de cuenta</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="bg-primary/10 text-primary flex h-16 w-16 items-center justify-center rounded-full text-xl font-bold">
              {displayName.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="text-lg font-semibold">{displayName}</p>
              <p className="text-base-content/60">{user?.email}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* MFA Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Smartphone className="text-primary size-5" />
            <CardTitle>Autenticación de dos factores (MFA)</CardTitle>
          </div>
          <CardDescription>
            Añade una capa extra de seguridad usando una app como Google Authenticator o Authy.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isMfaEnabled ? (
            <div className="bg-success/10 text-success-content flex items-center gap-2 rounded-lg px-4 py-3 text-sm">
              <Check className="size-4" />
              <span className="font-medium">MFA está activado en tu cuenta.</span>
              <div className="ml-auto">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-error hover:bg-error/10"
                  onClick={handleDisableMfa}
                  disabled={disableMfaMutation.isPending}
                >
                  Desactivar
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {!qrCodeUrl ? (
                <Button onClick={() => setupMfaMutation.mutate()} disabled={setupMfaMutation.isPending}>
                  {setupMfaMutation.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                  Configurar MFA
                </Button>
              ) : (
                <div className="border-base-300 bg-base-200/50 rounded-xl border p-4">
                  <div className="mb-4 text-center">
                    <p className="mb-2 text-sm font-medium">1. Escanea este código QR con tu app de autenticación:</p>
                    <img
                      src={qrCodeUrl}
                      alt="QR Code"
                      className="mx-auto rounded-lg bg-white p-2 shadow-sm"
                      loading="lazy"
                      decoding="async"
                    />
                    <p className="text-base-content/50 mt-2 text-xs">Secreto: {mfaSecret}</p>
                  </div>

                  <div className="mx-auto max-w-xs space-y-3">
                    <p className="text-sm font-medium">2. Ingresa el código de 6 dígitos:</p>
                    <div className="flex gap-2">
                      <Input
                        value={mfaToken}
                        onChange={(e) => setMfaToken(e.target.value)}
                        placeholder="000000"
                        className="text-center tracking-widest"
                        maxLength={6}
                        autoComplete="one-time-code"
                      />
                      <Button
                        onClick={() => enableMfaMutation.mutate(mfaToken)}
                        disabled={enableMfaMutation.isPending || mfaToken.length !== 6}
                      >
                        {enableMfaMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : "Activar"}
                      </Button>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-base-content/50 w-full"
                      onClick={() => {
                        setQrCodeUrl(null);
                        setMfaSecret(null);
                      }}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Passkey Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Fingerprint className="text-secondary size-5" />
            <CardTitle>Passkeys / biometría</CardTitle>
          </div>
          <CardDescription>
            Inicia sesión sin contraseña usando tu huella dactilar, reconocimiento facial o PIN del dispositivo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hasPasskey ? (
            <div className="bg-success/10 text-success-content flex items-center gap-2 rounded-lg px-4 py-3 text-sm">
              <Check className="size-4" />
              <span className="font-medium">Passkey configurado.</span>
              <div className="ml-auto flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-error hover:bg-error/10"
                  onClick={handleDeletePasskey}
                  disabled={deletePasskeyMutation.isPending}
                >
                  Eliminar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => registerPasskeyMutation.mutate()}
                  disabled={registerPasskeyMutation.isPending}
                >
                  Reemplazar
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                onClick={() => registerPasskeyMutation.mutate()}
                disabled={registerPasskeyMutation.isPending}
              >
                {registerPasskeyMutation.isPending ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Fingerprint className="mr-2 size-4" />
                )}
                Registrar nuevo passkey
              </Button>
            </div>
          )}

          <p className="text-base-content/50 mt-4 text-xs">
            Nota: Solo puedes tener un passkey activo por usuario. Registrar uno nuevo reemplazará el anterior.
          </p>
        </CardContent>
      </Card>

      {/* Logout Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <LogOut className="text-error size-5" />
            <CardTitle>Sesión</CardTitle>
          </div>
          <CardDescription>Cerrar sesión en este dispositivo</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" className="text-error border-error/30 hover:bg-error/10" onClick={() => logout()}>
            <LogOut className="mr-2 size-4" />
            Cerrar sesión
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
