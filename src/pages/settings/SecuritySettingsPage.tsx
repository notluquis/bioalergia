import { useState, useEffect } from "react";
import { startRegistration } from "@simplewebauthn/browser";
import type { PublicKeyCredentialCreationOptionsJSON } from "@simplewebauthn/types";
import { Smartphone, Fingerprint, Check, Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { apiClient } from "@/lib/apiClient";

export default function SecuritySettingsPage() {
  const { user, refreshSession } = useAuth();
  const { success, error } = useToast();

  // MFA State
  const [mfaSecret, setMfaSecret] = useState<string | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [mfaToken, setMfaToken] = useState("");
  const [loadingMfa, setLoadingMfa] = useState(false);
  const [isMfaEnabled, setIsMfaEnabled] = useState(user?.mfaEnabled ?? false);

  // Passkey State
  const [loadingPasskey, setLoadingPasskey] = useState(false);

  useEffect(() => {
    if (user) setIsMfaEnabled(user.mfaEnabled ?? false);
  }, [user]);

  // --- MFA Handlers ---
  const handleSetupMfa = async () => {
    setLoadingMfa(true);
    try {
      const data = await apiClient.post<{ status: string; secret: string; qrCodeUrl: string; message?: string }>(
        "/api/auth/mfa/setup",
        {}
      );
      if (data.status === "ok") {
        setMfaSecret(data.secret);
        setQrCodeUrl(data.qrCodeUrl);
      } else {
        error(data.message || "Error al iniciar configuración MFA");
      }
    } catch {
      error("Error de conexión");
    } finally {
      setLoadingMfa(false);
    }
  };

  const handleEnableMfa = async () => {
    setLoadingMfa(true);
    try {
      const data = await apiClient.post<{ status: string; message?: string }>("/api/auth/mfa/enable", {
        token: mfaToken,
        userId: user?.id,
      });

      if (data.status === "ok") {
        success("MFA activado correctamente");
        setIsMfaEnabled(true);
        setMfaSecret(null);
        setQrCodeUrl(null);
        await refreshSession();
      } else {
        error(data.message || "Código incorrecto");
      }
    } catch {
      error("Error al activar MFA");
    } finally {
      setLoadingMfa(false);
    }
  };

  const handleDisableMfa = async () => {
    if (!confirm("¿Estás seguro de desactivar la autenticación de dos factores? Tu cuenta será menos segura.")) return;

    setLoadingMfa(true);
    try {
      const data = await apiClient.post<{ status: string }>("/api/auth/mfa/disable", {});
      if (data.status === "ok") {
        success("MFA desactivado");
        setIsMfaEnabled(false);
        await refreshSession();
      } else {
        error("No se pudo desactivar MFA");
      }
    } catch {
      error("Error de conexión");
    } finally {
      setLoadingMfa(false);
    }
  };

  // --- Passkey Handlers ---
  const handleRegisterPasskey = async () => {
    setLoadingPasskey(true);
    try {
      // 1. Get options
      // 1. Get options
      // 1. Get options
      type PasskeyOptionsResponse = PublicKeyCredentialCreationOptionsJSON & {
        status?: string;
        message?: string;
      };

      const options = await apiClient.get<PasskeyOptionsResponse>("/api/auth/passkey/register/options");

      if (options.status === "error") throw new Error(options.message);

      // 2. Create credential
      const attResp = await startRegistration({ optionsJSON: options });

      // 3. Verify
      const verifyData = await apiClient.post<{ status: string; message?: string }>(
        "/api/auth/passkey/register/verify",
        { body: attResp, challenge: options.challenge }
      );
      if (verifyData.status === "ok") {
        success("Passkey registrado exitosamente");
        await refreshSession();
      } else {
        error(verifyData.message || "Error al verificar Passkey");
      }
    } catch (err) {
      console.error(err);
      error(err instanceof Error ? err.message : "Error al registrar Passkey");
    } finally {
      setLoadingPasskey(false);
    }
  };

  const handleDeletePasskey = async () => {
    if (!confirm("¿Estás seguro de eliminar tu Passkey? Tendrás que usar tu contraseña para iniciar sesión.")) return;

    setLoadingPasskey(true);
    try {
      const data = await apiClient.delete<{ status: string; message?: string }>("/api/auth/passkey/remove");
      if (data.status === "ok") {
        success("Passkey eliminado");
        await refreshSession();
      } else {
        error(data.message || "Error al eliminar Passkey");
      }
    } catch {
      error("Error de conexión");
    } finally {
      setLoadingPasskey(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1 px-6 pt-6">
        <h2 className="text-lg font-semibold text-primary drop-shadow-sm">Seguridad de la Cuenta</h2>
        <p className="text-sm text-base-content/70">Gestiona tus métodos de autenticación para proteger tu cuenta.</p>
      </div>

      {/* MFA Section */}
      <section className="bg-base-100 p-6">
        <div className="flex items-start gap-4">
          <div className="rounded-full bg-primary/10 p-3 text-primary">
            <Smartphone className="size-6" />
          </div>
          <div className="flex-1 space-y-4">
            <div>
              <h3 className="font-semibold text-base-content">Autenticación de dos factores (MFA)</h3>
              <p className="text-sm text-base-content/70">
                Añade una capa extra de seguridad usando una app como Google Authenticator o Authy.
              </p>
            </div>

            {isMfaEnabled ? (
              <div className="flex items-center gap-2 rounded-lg bg-success/10 px-4 py-3 text-sm text-success-content">
                <Check className="size-4" />
                <span className="font-medium">MFA está activado en tu cuenta.</span>
                <div className="ml-auto">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-error hover:bg-error/10"
                    onClick={handleDisableMfa}
                    disabled={loadingMfa}
                  >
                    Desactivar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {!qrCodeUrl ? (
                  <Button onClick={handleSetupMfa} disabled={loadingMfa}>
                    {loadingMfa ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                    Configurar MFA
                  </Button>
                ) : (
                  <div className="rounded-xl border border-base-300 bg-base-200/50 p-4">
                    <div className="mb-4 text-center">
                      <p className="mb-2 text-sm font-medium">1. Escanea este código QR con tu app de autenticación:</p>
                      <img src={qrCodeUrl} alt="QR Code" className="mx-auto rounded-lg bg-white p-2 shadow-sm" />
                      <p className="mt-2 text-xs text-base-content/50">Secreto: {mfaSecret}</p>
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
                        <Button onClick={handleEnableMfa} disabled={loadingMfa || mfaToken.length !== 6}>
                          {loadingMfa ? <Loader2 className="size-4 animate-spin" /> : "Activar"}
                        </Button>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-base-content/50"
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
          </div>
        </div>
      </section>

      {/* Passkey Section */}
      <section className="bg-base-100 p-6">
        <div className="flex items-start gap-4">
          <div className="rounded-full bg-secondary/10 p-3 text-secondary">
            <Fingerprint className="size-6" />
          </div>
          <div className="flex-1 space-y-4">
            <div>
              <h3 className="font-semibold text-base-content">Passkeys / Biometría</h3>
              <p className="text-sm text-base-content/70">
                Inicia sesión sin contraseña usando tu huella dactilar, reconocimiento facial o PIN del dispositivo.
              </p>
            </div>

            {(user as unknown as { hasPasskey: boolean })?.hasPasskey ? (
              <div className="flex items-center gap-2 rounded-lg bg-success/10 px-4 py-3 text-sm text-success-content">
                <Check className="size-4" />
                <span className="font-medium">Passkey configurado.</span>
                <div className="ml-auto flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-error hover:bg-error/10"
                    onClick={handleDeletePasskey}
                    disabled={loadingPasskey}
                  >
                    Eliminar
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleRegisterPasskey} disabled={loadingPasskey}>
                    Reemplazar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <Button onClick={handleRegisterPasskey} disabled={loadingPasskey} variant="outline">
                  {loadingPasskey ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <Fingerprint className="mr-2 size-4" />
                  )}
                  Registrar nuevo Passkey
                </Button>
              </div>
            )}

            <p className="text-xs text-base-content/50">
              Nota: Solo puedes tener un Passkey activo por usuario. Registrar uno nuevo reemplazará el anterior.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
