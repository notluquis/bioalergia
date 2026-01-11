import { startRegistration } from "@simplewebauthn/browser";
import { useMutation } from "@tanstack/react-query";
import { Check, Fingerprint, Loader2, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";

import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import {
  disableMfa,
  enableMfa,
  fetchPasskeyRegistrationOptions,
  removePasskey,
  setupMfa,
  verifyPasskeyRegistration,
} from "@/features/auth/api";

export default function AccountSettingsPage() {
  const { user, refreshSession } = useAuth();
  const { success, error } = useToast();

  // MFA State
  const [mfaSecret, setMfaSecret] = useState<string | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [mfaToken, setMfaToken] = useState("");
  const [isMfaEnabled, setIsMfaEnabled] = useState(user?.mfaEnabled ?? false);

  useEffect(() => {
    if (user) setIsMfaEnabled(user.mfaEnabled ?? false);
  }, [user]);

  // --- MFA Handlers ---
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

  // --- Passkey Handlers ---
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

  return (
    <div className="space-y-6">
      <div className="space-y-1 px-6 pt-6">
        <h2 className="text-primary text-lg font-semibold drop-shadow-sm">Seguridad de la cuenta</h2>
        <p className="text-base-content/70 text-sm">Gestiona tus métodos de autenticación para proteger tu cuenta.</p>
      </div>

      {/* MFA Section */}
      <section className="bg-base-100 p-6">
        <div className="flex items-start gap-4">
          <div className="bg-primary/10 text-primary rounded-full p-3">
            <Smartphone className="size-6" />
          </div>
          <div className="flex-1 space-y-4">
            <div>
              <h3 className="text-base-content font-semibold">Autenticación de dos factores (MFA)</h3>
              <p className="text-base-content/70 text-sm">
                Añade una capa extra de seguridad usando una app como Google Authenticator o Authy.
              </p>
            </div>

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
                {qrCodeUrl ? (
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
                ) : (
                  <Button onClick={() => setupMfaMutation.mutate()} disabled={setupMfaMutation.isPending}>
                    {setupMfaMutation.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                    Configurar MFA
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Passkey Section */}
      <section className="bg-base-100 p-6">
        <div className="flex items-start gap-4">
          <div className="bg-secondary/10 text-secondary rounded-full p-3">
            <Fingerprint className="size-6" />
          </div>
          <div className="flex-1 space-y-4">
            <div>
              <h3 className="text-base-content font-semibold">Passkeys / biometría</h3>
              <p className="text-base-content/70 text-sm">
                Inicia sesión sin contraseña usando tu huella dactilar, reconocimiento facial o PIN del dispositivo.
              </p>
            </div>

            {(user as unknown as { hasPasskey: boolean })?.hasPasskey ? (
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

            <p className="text-base-content/50 text-xs">
              Nota: Solo puedes tener un passkey activo por usuario. Registrar uno nuevo reemplazará el anterior.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
