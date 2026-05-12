import { Button, Input, TextField } from "@heroui/react";
import { startRegistration } from "@simplewebauthn/browser";
import { useMutation } from "@tanstack/react-query";
import { Check, Fingerprint, Loader2, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useConfirmDialog } from "@/context/ConfirmDialogContext";
import { useToast } from "@/context/ToastContext";
import {
  disableMfa,
  enableMfa,
  fetchPasskeyRegistrationOptions,
  removePasskey,
  setupMfa,
  verifyPasskeyRegistration,
} from "@/features/auth/api";
export function AccountSettingsPage() {
  const { refreshSession, user } = useAuth();
  const { error, success } = useToast();
  const confirm = useConfirmDialog();

  // MFA State
  const [mfaSecret, setMfaSecret] = useState<null | string>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<null | string>(null);
  const [mfaToken, setMfaToken] = useState("");
  const [isMfaEnabled, setIsMfaEnabled] = useState(user?.mfaEnabled ?? false);

  useEffect(() => {
    if (user) {
      setIsMfaEnabled(user.mfaEnabled ?? false);
    }
  }, [user]);

  // --- MFA Handlers ---
  // --- MFA Mutations ---
  const setupMfaMutation = useMutation({
    mutationFn: () =>
      setupMfa().then((res) => {
        if (res.status !== "ok") {
          throw new Error(res.message ?? "Error al iniciar configuración MFA");
        }
        return res;
      }),
    onError: (err) => {
      error(err instanceof Error ? err.message : "Error al iniciar configuración MFA");
    },
    onSuccess: (data) => {
      setMfaSecret(data.secret);
      setQrCodeUrl(data.qrCodeUrl);
    },
  });

  const enableMfaMutation = useMutation({
    mutationFn: (token: string) =>
      enableMfa({ token, userId: user?.id }).then((res) => {
        if (res.status !== "ok") {
          throw new Error(res.message ?? "Código incorrecto");
        }
        return res;
      }),
    onError: (err) => {
      error(err instanceof Error ? err.message : "Error al activar MFA");
    },
    onSuccess: async () => {
      success("MFA activado correctamente");
      setIsMfaEnabled(true);
      setMfaSecret(null);
      setQrCodeUrl(null);
      await refreshSession();
    },
  });

  const disableMfaMutation = useMutation({
    mutationFn: () =>
      disableMfa().then((res) => {
        if (res.status !== "ok") {
          throw new Error("No se pudo desactivar MFA");
        }
        return res;
      }),
    onError: () => {
      error("Error al desactivar MFA");
    },
    onSuccess: async () => {
      success("MFA desactivado");
      setIsMfaEnabled(false);
      await refreshSession();
    },
  });

  const handleDisableMfa = async () => {
    const confirmed = await confirm({
      confirmLabel: "Desactivar MFA",
      confirmVariant: "danger",
      description:
        "¿Estás seguro de desactivar la autenticación de dos factores? Tu cuenta será menos segura.",
      isDismissable: true,
      isKeyboardDismissDisabled: false,
      status: "danger",
      title: "Desactivar autenticación MFA",
    });
    if (!confirmed) {
      return;
    }
    disableMfaMutation.mutate();
  };

  // --- Passkey Handlers ---
  // --- Passkey Mutations ---
  const registerPasskeyMutation = useMutation({
    mutationFn: async () => {
      const result = await fetchPasskeyRegistrationOptions();

      if (result.type === "error") {
        // Type-safe discriminated union narrowing
        throw new Error(result.message ?? "Error al obtener opciones");
      }

      // After narrowing, result.options is PublicKeyCredentialCreationOptionsJSON
      // No cast needed - this is the exact type @simplewebauthn/browser expects
      const attResp = await startRegistration({
        optionsJSON: result.options,
      });

      const verifyData = await verifyPasskeyRegistration({
        body: attResp,
        challenge: result.options.challenge,
      });
      if (verifyData.status !== "ok") {
        throw new Error(verifyData.message ?? "Error al verificar passkey");
      }

      return verifyData;
    },
    onError: (err) => {
      console.error(err);
      error(err instanceof Error ? err.message : "Error al registrar passkey");
    },
    onSuccess: async () => {
      success("Passkey registrado exitosamente");
      await refreshSession();
    },
  });

  const deletePasskeyMutation = useMutation({
    mutationFn: () =>
      removePasskey().then((res) => {
        if (res.status !== "ok") {
          throw new Error(res.message ?? "Error al eliminar passkey");
        }
        return res;
      }),
    onError: (err) => {
      error(err instanceof Error ? err.message : "Error al eliminar passkey");
    },
    onSuccess: async () => {
      success("Passkey eliminado");
      await refreshSession();
    },
  });

  const handleDeletePasskey = async () => {
    const confirmed = await confirm({
      confirmLabel: "Eliminar passkey",
      confirmVariant: "danger",
      description:
        "¿Estás seguro de eliminar tu passkey? Tendrás que usar tu contraseña para iniciar sesión.",
      isDismissable: true,
      isKeyboardDismissDisabled: false,
      status: "danger",
      title: "Eliminar passkey",
    });
    if (!confirmed) {
      return;
    }
    deletePasskeyMutation.mutate();
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1 px-6 pt-6">
        <h2 className="font-semibold text-lg text-primary drop-shadow-sm">
          Seguridad de la cuenta
        </h2>
        <p className="text-default-600 text-sm">
          Gestiona tus métodos de autenticación para proteger tu cuenta.
        </p>
      </div>

      {/* MFA Section */}
      <section className="bg-background p-6">
        <div className="flex items-start gap-4">
          <div className="rounded-full bg-primary/10 p-3 text-primary">
            <Smartphone className="size-6" />
          </div>
          <div className="flex-1 space-y-4">
            <div>
              <h3 className="font-semibold text-foreground">Autenticación de dos factores (MFA)</h3>
              <p className="text-default-600 text-sm">
                Añade una capa extra de seguridad usando una app como Google Authenticator o Authy.
              </p>
            </div>

            {isMfaEnabled ? (
              <div className="flex items-center gap-2 rounded-lg bg-success/10 px-4 py-3 text-sm text-success-foreground">
                <Check className="size-4" />
                <span className="font-medium">MFA está activado en tu cuenta.</span>
                <div className="ml-auto">
                  <Button
                    className="text-danger hover:bg-danger/10"
                    isDisabled={disableMfaMutation.isPending}
                    onPress={handleDisableMfa}
                    size="sm"
                    variant="outline"
                  >
                    Desactivar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {qrCodeUrl ? (
                  <div className="rounded-xl border border-default-200 bg-default-50/50 p-4">
                    <div className="mb-4 text-center">
                      <p className="mb-2 font-medium text-sm">
                        1. Escanea este código QR con tu app de autenticación:
                      </p>
                      <img
                        alt="QR Code"
                        className="mx-auto rounded-lg bg-white p-2 shadow-sm"
                        decoding="async"
                        loading="lazy"
                        src={qrCodeUrl}
                      />

                      <p className="mt-2 text-default-400 text-xs">Secreto: {mfaSecret}</p>
                    </div>

                    <div className="mx-auto max-w-xs space-y-3">
                      <p className="font-medium text-sm">2. Ingresa el código de 6 dígitos:</p>
                      <div className="flex gap-2">
                        <TextField value={mfaToken} onChange={(v) => setMfaToken(v)}>
                          <Input
                            autoComplete="one-time-code"
                            className="text-center tracking-widest"
                            maxLength={6}
                            placeholder="000000"
                          />
                        </TextField>

                        <Button
                          isDisabled={enableMfaMutation.isPending || mfaToken.length !== 6}
                          onPress={() => {
                            enableMfaMutation.mutate(mfaToken);
                          }}
                        >
                          {enableMfaMutation.isPending ? (
                            <Loader2 className="size-4 " />
                          ) : (
                            "Activar"
                          )}
                        </Button>
                      </div>
                      <Button
                        className="w-full text-default-400"
                        onPress={() => {
                          setQrCodeUrl(null);
                          setMfaSecret(null);
                        }}
                        size="sm"
                        variant="outline"
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    isDisabled={setupMfaMutation.isPending}
                    onPress={() => {
                      setupMfaMutation.mutate();
                    }}
                  >
                    {setupMfaMutation.isPending ? <Loader2 className="mr-2 size-4 " /> : null}
                    Configurar MFA
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Passkey Section */}
      <section className="bg-background p-6">
        <div className="flex items-start gap-4">
          <div className="rounded-full bg-secondary/10 p-3 text-secondary">
            <Fingerprint className="size-6" />
          </div>
          <div className="flex-1 space-y-4">
            <div>
              <h3 className="font-semibold text-foreground">Passkeys / biometría</h3>
              <p className="text-default-600 text-sm">
                Inicia sesión sin contraseña usando tu huella dactilar, reconocimiento facial o PIN
                del dispositivo.
              </p>
            </div>

            {user?.hasPasskey ? (
              <div className="flex items-center gap-2 rounded-lg bg-success/10 px-4 py-3 text-sm text-success-foreground">
                <Check className="size-4" />
                <span className="font-medium">Passkey configurado.</span>
                <div className="ml-auto flex gap-2">
                  <Button
                    className="text-danger hover:bg-danger/10"
                    isDisabled={deletePasskeyMutation.isPending}
                    onPress={handleDeletePasskey}
                    size="sm"
                    variant="outline"
                  >
                    Eliminar
                  </Button>
                  <Button
                    isDisabled={registerPasskeyMutation.isPending}
                    onPress={() => {
                      registerPasskeyMutation.mutate();
                    }}
                    size="sm"
                    variant="outline"
                  >
                    Reemplazar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <Button
                  isDisabled={registerPasskeyMutation.isPending}
                  onPress={() => {
                    registerPasskeyMutation.mutate();
                  }}
                  variant="outline"
                >
                  {registerPasskeyMutation.isPending ? (
                    <Loader2 className="mr-2 size-4 " />
                  ) : (
                    <Fingerprint className="mr-2 size-4" />
                  )}
                  Registrar nuevo passkey
                </Button>
              </div>
            )}

            <p className="text-default-400 text-xs">
              Nota: Solo puedes tener un passkey activo por usuario. Registrar uno nuevo reemplazará
              el anterior.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
