import { Card, Chip, Link } from "@heroui/react";
import { usePostHog } from "posthog-js/react";
import { useEffect, useState } from "react";

import { doctoraliaLink } from "@/lib/doctoralia";

function useDoctoraliaScript() {
  useEffect(() => {
    const existing = document.getElementById("zl-widget-s");
    if (existing) {
      return;
    }

    const script = document.createElement("script");
    script.id = "zl-widget-s";
    script.src = "//platform.docplanner.com/js/widget.js";
    script.async = true;
    document.body.appendChild(script);
  }, []);
}

/** Lee la altura real que el iframe del widget reporta vía postMessage. */
function extractWidgetHeight(data: unknown): number | null {
  let parsed = data;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return null;
    }
  }
  if (typeof parsed !== "object" || parsed === null) {
    return null;
  }
  const obj = parsed as Record<string, unknown>;
  const height = obj.height ?? obj.resizeHeight;
  return typeof height === "number" ? height : null;
}

/**
 * El loader de Docplanner reemplaza el `<a>` por un `<iframe>` con `width:100%`
 * SIN height → arranca en ~150px (caja chica con spinner) y luego el iframe
 * postMessea su altura real → el loader la aplica y crece. Ese salto es el CLS.
 * No hay atributo `data-zlw-*` de altura. Detectamos la primera altura real (o un
 * timeout de respaldo) para fundir el skeleton; el `min-height` del wrapper
 * reserva espacio para que la página no salte mientras carga. Progressive
 * enhancement: si el mensaje cambia, igual cae el timeout y el widget funciona.
 */
function useDoctoraliaWidgetLoaded() {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (typeof event.origin === "string" && !event.origin.includes("docplanner")) {
        return;
      }
      const height = extractWidgetHeight(event.data);
      if (height !== null && height > 100) {
        setLoaded(true);
      }
    };
    window.addEventListener("message", onMessage);
    const fallback = setTimeout(() => setLoaded(true), 4000);
    return () => {
      window.removeEventListener("message", onMessage);
      clearTimeout(fallback);
    };
  }, []);

  return loaded;
}

export function DoctoraliaBookingWidget() {
  useDoctoraliaScript();
  const loaded = useDoctoraliaWidgetLoaded();
  const posthog = usePostHog();

  return (
    <Card
      className="h-fit overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_24px_70px_rgba(0,0,0,0.18)]"
      variant="tertiary"
    >
      <Card.Header className="flex flex-col items-start justify-start gap-4 px-3 pt-4 pb-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-4 sm:pt-5 md:pt-6">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="text-(--ink-muted) text-xs uppercase tracking-[0.28em]">
            Reserva online
          </div>
          <Card.Title className="text-lg sm:text-xl md:text-2xl">
            Agenda tu cita en Doctoralia
          </Card.Title>
          <Card.Description className="max-w-xl text-(--ink-muted) text-sm sm:text-base">
            Confirma tu evaluación directamente en Doctoralia y recibe la confirmación por correo.
          </Card.Description>
        </div>
        <Chip className="shrink-0 self-start" size="sm" variant="soft">
          Reserva inmediata
        </Chip>
      </Card.Header>
      <Card.Content className="space-y-4 px-2 pb-3 sm:px-3 sm:pb-3 md:px-3">
        <div className="mx-auto w-full max-w-full rounded-2xl border border-border bg-white p-1.5 shadow-[0_18px_45px_rgba(0,0,0,0.12)] sm:p-2">
          {/* `min-h` reserva espacio durante la carga. SIN cap de altura: el
              widget se muestra completo (la gente no descubre el scroll
              interno). En desktop reservamos casi la altura del calendario
              completo (`lg:min-h-[42rem]`) para que el resize post-carga casi no
              empuje el contenido de abajo (evita CLS). La columna de copy
              izquierda fluye natural. Skeleton mientras `!loaded`. */}
          <div className="relative min-h-[25rem] lg:min-h-[42rem]" aria-busy={!loaded}>
            {!loaded ? (
              <div
                aria-hidden="true"
                className="absolute inset-0 animate-pulse rounded-xl bg-(--surface-2)"
              />
            ) : null}
            <a
              id="zl-url-booking"
              className="zl-url block"
              href={doctoraliaLink}
              rel="nofollow"
              data-zlw-doctor="jose-manuel-martinez-martinez"
              data-zlw-type="big_with_calendar"
              data-zlw-opinion="false"
              data-zlw-hide-branding="true"
              data-zlw-saas-only="true"
              data-zlw-a11y-title="Widget de reserva de citas médicas"
              onClick={() =>
                posthog?.capture("doctoralia_widget_interaction", {
                  type: "booking_widget",
                  section: "doctoralia_widgets",
                })
              }
            >
              José Manuel Martínez Martínez - Doctoralia.cl
            </a>
          </div>
        </div>
        <noscript>
          <Link className="text-sm" href={doctoraliaLink} rel="nofollow">
            Ver disponibilidad en Doctoralia
          </Link>
        </noscript>
      </Card.Content>
    </Card>
  );
}
