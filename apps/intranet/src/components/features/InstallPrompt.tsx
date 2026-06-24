import { Button } from "@heroui/react";
import { Download, Share, X } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * PWA install affordance (golden 2026).
 *
 * - Android / desktop Chromium: captures `beforeinstallprompt`, shows an
 *   "Instalar app" button that fires the native prompt.
 * - iOS Safari: there is NO install API, AND iOS Web Push only works once the
 *   PWA is installed (iOS 16.4+). So we show a manual "Compartir → Agregar a
 *   inicio" hint — without it, iPhone users can never install or receive push.
 *
 * Hidden when already installed (standalone) or recently dismissed.
 */

// Chromium-only event — not in lib.dom.
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt: () => Promise<void>;
}

const DISMISS_KEY = "pwa-install-dismissed-at";
const DISMISS_TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14 days

function isStandalone(): boolean {
  const mm = globalThis.matchMedia?.("(display-mode: standalone)").matches ?? false;
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return mm || iosStandalone;
}

function isIosSafari(): boolean {
  const ua = navigator.userAgent;
  const isIos = /iphone|ipad|ipod/i.test(ua) || (ua.includes("Mac") && "ontouchend" in document);
  const isSafari = /^((?!chrome|android|crios|fxios|edgios).)*safari/i.test(ua);
  return isIos && isSafari;
}

function recentlyDismissed(): boolean {
  const ts = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
  return Date.now() - ts < DISMISS_TTL_MS;
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [mode, setMode] = useState<"none" | "prompt" | "ios">("none");

  useEffect(() => {
    if (isStandalone() || recentlyDismissed()) {
      return;
    }

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setMode("prompt");
    };
    const onInstalled = () => {
      setDeferred(null);
      setMode("none");
    };
    globalThis.addEventListener("beforeinstallprompt", onBeforeInstall);
    globalThis.addEventListener("appinstalled", onInstalled);

    // iOS Safari has no beforeinstallprompt — show the manual hint instead.
    if (isIosSafari()) {
      setMode("ios");
    }

    return () => {
      globalThis.removeEventListener("beforeinstallprompt", onBeforeInstall);
      globalThis.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setMode("none");
  };

  const install = async () => {
    if (!deferred) {
      return;
    }
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    setMode("none");
  };

  if (mode === "none") {
    return null;
  }

  return (
    <div
      aria-label="Instalar aplicación"
      className="slide-in-from-bottom-5 fade-in fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+6rem)] z-50 mx-auto max-w-sm md:right-4 md:bottom-4 md:left-auto"
      role="region"
    >
      <div className="rounded-2xl border border-primary/20 bg-background p-4 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Download aria-hidden="true" className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-foreground text-sm">Instalar Bioalergia</h3>
            {mode === "prompt" ? (
              <>
                <p className="mt-1 text-default-600 text-xs">
                  Acceso directo, pantalla completa y notificaciones.
                </p>
                <div className="mt-3 flex gap-2">
                  <Button
                    className="flex-1"
                    onPress={() => {
                      void install();
                    }}
                    size="sm"
                    variant="primary"
                  >
                    Instalar app
                  </Button>
                  <Button className="px-3" onPress={dismiss} size="sm" variant="outline">
                    <X className="size-4" />
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="mt-1 text-default-600 text-xs">
                  Toca{" "}
                  <Share aria-label="Compartir" className="inline size-3.5 align-text-bottom" /> y
                  luego “Agregar a inicio” para instalar y recibir notificaciones.
                </p>
                <div className="mt-3 flex justify-end">
                  <Button onPress={dismiss} size="sm" variant="outline">
                    Entendido
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
