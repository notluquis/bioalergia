// oxlint-disable typescript/no-non-null-assertion -- TODO(strict-null): refactor each `!` to invariant() or explicit guard. Tracked in repo-wide non-null cleanup.
import { Button } from "@heroui/react";
import { LogIn, Smartphone } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "@/lib/toast-interceptor";
import { useEmbeddedSignupComplete } from "../hooks/useWaCloud";

// Two variants of Meta Embedded Signup:
//   - "embedded_signup": standard flow — number moves exclusively to Cloud API.
//   - "coexistence":     Meta 2025 — number stays on the WA Business app (SIM)
//                        AND mirrors into Cloud API via Messaging Echoes.
//                        Requires WA Business app v2.24.17+, 5 mps cap, history
//                        sync up to 6 months. Unsupported in EU/EEA.
export type EmbeddedSignupVariant = "embedded_signup" | "coexistence";

// Loads the Meta JS SDK on demand and triggers FB.login with the
// whatsapp_embedded_signup config. On success the SDK posts a
// session message containing phone_number_id + waba_id + the system
// user access token, which we POST to embeddedSignupComplete to
// create the WaBusinessAccount + WaPhoneNumber rows server-side.
//
// Requires VITE_META_APP_ID + VITE_META_EMBEDDED_SIGNUP_CONFIG_ID env
// vars (configured in your Meta App that has the WhatsApp Business
// Embedded Signup product enabled).

declare global {
  interface Window {
    FB?: {
      init: (opts: { appId: string; cookie?: boolean; xfbml?: boolean; version: string }) => void;
      login: (
        cb: (resp: {
          authResponse?: { code?: string; accessToken?: string };
          status?: string;
        }) => void,
        opts?: Record<string, unknown>
      ) => void;
    };
    fbAsyncInit?: () => void;
  }
}

const APP_ID = import.meta.env.VITE_META_APP_ID as string | undefined;
const CONFIG_ID = import.meta.env.VITE_META_EMBEDDED_SIGNUP_CONFIG_ID as string | undefined;

function loadFbSdk(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.FB) return resolve();
    if (!APP_ID) return reject(new Error("VITE_META_APP_ID no configurado"));
    window.fbAsyncInit = () => {
      window.FB!.init({ appId: APP_ID, cookie: true, xfbml: true, version: "v25.0" });
      resolve();
    };
    const script = document.createElement("script");
    script.src = "https://connect.facebook.net/en_US/sdk.js";
    script.async = true;
    script.defer = true;
    script.onerror = () => reject(new Error("No se pudo cargar Meta SDK"));
    document.head.appendChild(script);
  });
}

export interface EmbeddedSignupButtonProps {
  variant?: EmbeddedSignupVariant;
}

export function EmbeddedSignupButton({
  variant = "embedded_signup",
}: EmbeddedSignupButtonProps = {}) {
  const isCoexistence = variant === "coexistence";
  const [busy, setBusy] = useState(false);
  const complete = useEmbeddedSignupComplete();
  const sessionRef = useRef<{
    phone_number_id?: string;
    waba_id?: string;
    business_id?: string;
  }>({});

  // Listen for the Meta postMessage that contains the WABA + phone ids.
  // The Embedded Signup popup posts this back to the opener once the
  // user finishes onboarding.
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.origin !== "https://www.facebook.com") return;
      try {
        const data = JSON.parse(event.data) as {
          type?: string;
          event?: string;
          data?: { phone_number_id?: string; waba_id?: string; business_id?: string };
        };
        if (data.type === "WA_EMBEDDED_SIGNUP" && data.event === "FINISH" && data.data) {
          sessionRef.current = data.data;
        }
      } catch {
        // ignore non-JSON postMessages
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  const onClick = async () => {
    if (!APP_ID || !CONFIG_ID) {
      toast.error("Faltan VITE_META_APP_ID y VITE_META_EMBEDDED_SIGNUP_CONFIG_ID en env.");
      return;
    }
    setBusy(true);
    try {
      await loadFbSdk();
      window.FB!.login(
        (resp) => {
          // FB SDK does not accept async callbacks; bridge to async work
          // via an IIFE so the SDK call itself stays synchronous.
          void (async () => {
            const token = resp.authResponse?.accessToken;
            const captured = sessionRef.current;
            if (!token || !captured.phone_number_id || !captured.waba_id) {
              toast.error("Embedded Signup no completó el flujo. Intenta de nuevo.");
              setBusy(false);
              return;
            }
            try {
              await complete.mutateAsync({
                wabaId: captured.waba_id,
                metaBusinessId: captured.business_id,
                appId: APP_ID,
                systemUserToken: token,
                phoneNumberId: captured.phone_number_id,
                displayPhoneNumber: "—", // populated by next syncPhoneNumbers
                onboardingFlow: variant,
              });
              toast.success(
                isCoexistence
                  ? "Coexistence activado — el celular sigue funcionando con WA Business"
                  : "Cuenta WABA creada vía Embedded Signup"
              );
            } catch (e) {
              toast.error(`Server: ${String(e)}`);
            } finally {
              setBusy(false);
            }
          })();
        },
        {
          config_id: CONFIG_ID,
          response_type: "code",
          override_default_response_type: true,
          extras: isCoexistence
            ? {
                feature: "whatsapp_embedded_signup",
                featureType: "whatsapp_business_app_onboarding",
                sessionInfoVersion: 3,
                version: 3,
              }
            : { feature: "whatsapp_embedded_signup", version: 2 },
        }
      );
    } catch (e) {
      toast.error(String(e));
      setBusy(false);
    }
  };

  return (
    <Button variant="outline" onPress={onClick} isPending={busy}>
      {isCoexistence ? <Smartphone size={14} /> : <LogIn size={14} />}
      {isCoexistence ? "Activar Coexistence (app + Cloud API)" : "Onboard vía Embedded Signup"}
    </Button>
  );
}
