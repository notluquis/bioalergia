import { useEffect } from "react";
import { Card, Chip, Link } from "@heroui/react";

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
      className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[0_24px_70px_rgba(0,0,0,0.18)]"
      variant="flat"
    >
      <Card.Header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-[0.28em] text-[color:var(--ink-muted)]">
            Reserva online
          </div>
          <Card.Title className="text-2xl">Agenda tu cita en Doctoralia</Card.Title>
          <Card.Description className="max-w-xl text-[color:var(--ink-muted)]">
            Confirma tu evaluación directamente en Doctoralia y recibe la confirmación por correo.
          </Card.Description>
        </div>
        <Chip size="sm" variant="soft">
          Reserva inmediata
        </Chip>
      </Card.Header>
      <Card.Content className="space-y-3">
        <a
          id="zl-url-booking"
          className="zl-url"
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
      className="h-full rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface)]"
      variant="flat"
    >
      <Card.Header className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-[0.28em] text-[color:var(--ink-muted)]">
            Pacientes satisfechos
          </div>
          <Card.Title className="text-2xl">Certificado Doctoralia</Card.Title>
        </div>
        <Chip size="sm" variant="soft">
          Verificado
        </Chip>
      </Card.Header>
      <Card.Content>
        <a
          id="zl-url-certificate"
          className="zl-url"
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
      </Card.Content>
    </Card>
  );
}

export const doctoraliaLink = doctoraliaUrl;
