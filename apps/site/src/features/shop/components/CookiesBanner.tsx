// Banner consentimiento cookies — Ley 21.719 (Protección de Datos
// Chile, vigente diciembre 2026). Granular: aceptar/rechazar
// analíticas. Las "necesarias" (sesión, CSRF, carrito) van sin opt-in.
//
// Sirve el banner UNA VEZ por navegador; persiste la decisión en
// localStorage para que apps externas (PostHog, Meta Pixel, GA4) lean
// el flag antes de cargar.

import { Button } from "@heroui/react";
import { useEffect, useState } from "react";

const STORAGE_KEY = "bioalergia.cookies";

type Decision = "accept" | "reject" | null;

function read(): Decision {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return raw === "accept" || raw === "reject" ? raw : null;
}

function write(d: Decision) {
  if (!d) return;
  window.localStorage.setItem(STORAGE_KEY, d);
  window.dispatchEvent(new CustomEvent("bioalergia:cookies", { detail: d }));
}

export function CookiesBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(read() === null);
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed right-0 bottom-0 left-0 z-50 border-foreground/10 border-t bg-surface px-4 py-3 shadow-lg sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-foreground/80 text-sm">
          Usamos cookies necesarias para que la tienda funcione (sesión, carrito) y, con tu permiso,
          cookies de análisis para mejorar el sitio.{" "}
          <a className="underline" href="/legal/cookies">
            Más info
          </a>
          .
        </p>
        <div className="flex gap-2">
          <Button
            onPress={() => {
              write("reject");
              setVisible(false);
            }}
            size="sm"
            variant="secondary"
          >
            Solo necesarias
          </Button>
          <Button
            onPress={() => {
              write("accept");
              setVisible(false);
            }}
            size="sm"
            variant="primary"
          >
            Aceptar todas
          </Button>
        </div>
      </div>
    </div>
  );
}

export function getCookieConsent(): Decision {
  return read();
}
