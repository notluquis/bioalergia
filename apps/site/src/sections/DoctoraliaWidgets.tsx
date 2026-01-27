import { Card, Chip, Link } from "@heroui/react";
import { useEffect } from "react";

const doctoraliaUrl =
  "https://www.doctoralia.cl/jose-manuel-martinez-martinez/inmunologo-alergologo/concepcion";

function useDoctoraliaScript() {
  useEffect(() => {
    const existing = document.getElementById("zl-widget-s");
    if (existing) return;

    const script = document.createElement("script");
    script.id = "zl-widget-s";
    script.src = "//platform.docplanner.com/js/widget.js";
    script.async = true;
    document.body.appendChild(script);
  }, []);
}

export function DoctoraliaBookingWidget() {
  useDoctoraliaScript();

  return (
    <Card
      className="overflow-hidden rounded-3xl border border-border bg-surface shadow-[0_24px_70px_rgba(0,0,0,0.18)]"
      variant="tertiary"
    >
      <Card.Header className="flex flex-col gap-4 items-start justify-start px-4 pt-4 pb-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5 sm:pt-5 md:px-6 md:pt-6">
        <div className="min-w-0 space-y-2 flex-1">
          <div className="text-xs uppercase tracking-[0.28em] text-(--ink-muted)">
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
      <Card.Content className="space-y-4 px-4 pb-4 sm:px-5 sm:pb-5 md:px-6 md:pb-6">
        <div className="mx-auto w-full max-w-full rounded-2xl border border-border bg-white p-2 shadow-[0_18px_45px_rgba(0,0,0,0.12)] sm:p-3 md:p-4">
          <a
            id="zl-url-booking"
            className="zl-url block"
            href={doctoraliaUrl}
            rel="nofollow"
            data-zlw-doctor="jose-manuel-martinez-martinez"
            data-zlw-type="big_with_calendar"
            data-zlw-opinion="false"
            data-zlw-hide-branding="true"
            data-zlw-saas-only="true"
            data-zlw-a11y-title="Widget de reserva de citas médicas"
          >
            José Manuel Martínez Martínez - Doctoralia.cl
          </a>
        </div>
        <noscript>
          <Link className="text-sm" href={doctoraliaUrl} rel="nofollow">
            Ver disponibilidad en Doctoralia
          </Link>
        </noscript>
      </Card.Content>
    </Card>
  );
}

export function DoctoraliaCertificate() {
  useDoctoraliaScript();

  return (
    <Card
      className="h-full overflow-hidden rounded-3xl border border-border bg-surface"
      variant="default"
    >
      <Card.Header className="flex flex-col gap-4 items-start justify-start px-4 pt-4 pb-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5 sm:pt-5 md:px-6 md:pt-6">
        <div className="min-w-0 space-y-2 flex-1">
          <div className="text-xs uppercase tracking-[0.28em] text-(--ink-muted)">
            Pacientes satisfechos
          </div>
          <Card.Title className="text-lg sm:text-xl md:text-2xl">Certificado Doctoralia</Card.Title>
          <Card.Description className="text-(--ink-muted) text-sm sm:text-base">
            Sello oficial de satisfacción y validación clínica.
          </Card.Description>
        </div>
        <Chip className="shrink-0 self-start" color="success" size="sm" variant="soft">
          Verificado
        </Chip>
      </Card.Header>
      <Card.Content className="flex justify-center px-4 pb-4 sm:px-5 sm:pb-5 md:px-6 md:pb-6">
        <div className="w-full rounded-2xl border border-border bg-white p-3 shadow-[0_18px_45px_rgba(0,0,0,0.12)] sm:p-4 md:p-5">
          <a
            id="zl-url-certificate"
            className="zl-url block"
            href={doctoraliaUrl}
            rel="nofollow"
            data-zlw-doctor="jose-manuel-martinez-martinez"
            data-zlw-type="certificate"
            data-zlw-opinion="false"
            data-zlw-hide-branding="true"
            data-zlw-saas-only="true"
            data-zlw-a11y-title="Certificado de pacientes satisfechos"
          >
            José Manuel Martínez Martínez - Doctoralia.cl
          </a>
        </div>
      </Card.Content>
    </Card>
  );
}
