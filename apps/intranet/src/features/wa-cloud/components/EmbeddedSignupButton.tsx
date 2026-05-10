import { Button } from "@heroui/react";
import { LogIn } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "@/lib/toast-interceptor";
import { useEmbeddedSignupComplete } from "../hooks/useWaCloud";

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
      init: (opts: { appId: string; version: string }) => void;
      login: (
        cb: (resp: {
          authResponse?: { code?: string; accessToken?: string };
          status?: string;
        }) => void,
        opts?: Record<string, unknown>,
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
      window.FB!.init({ appId: APP_ID, version: "v21.0" });
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

export function EmbeddedSignupButton() {
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
        async (resp) => {
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
            });
            toast.success("Cuenta WABA creada vía Embedded Signup");
          } catch (e) {
            toast.error(`Server: ${String(e)}`);
          } finally {
            setBusy(false);
          }
        },
        {
          config_id: CONFIG_ID,
          response_type: "code",
          override_default_response_type: true,
          extras: { feature: "whatsapp_embedded_signup", version: 2 },
        },
      );
    } catch (e) {
      toast.error(String(e));
      setBusy(false);
    }
  };

  return (
    <Button variant="outline" onPress={onClick} isPending={busy}>
      <LogIn size={14} />
      Onboard vía Embedded Signup
    </Button>
  );
}
