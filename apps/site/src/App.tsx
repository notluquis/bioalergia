import { useEffect, useMemo, useState } from "react";
import { Button, Card, Chip, Link, Separator } from "@heroui/react";

const doctoraliaUrl =
  "https://www.doctoralia.cl/jose-manuel-martinez-martinez/inmunologo-alergologo/concepcion";
const clinicAddress = "Avenida Prat 199, Oficina A603, Edificio Centro Costanera, Concepción";
const clinicMapQuery = encodeURIComponent(clinicAddress);
const clinicMapUrl = `https://www.google.com/maps/search/?api=1&query=${clinicMapQuery}`;
const clinicMapEmbedUrl = `https://www.google.com/maps?q=${clinicMapQuery}&output=embed`;

const badges = ["Alergología", "Inmunología", "Adultos y niños", "Concepción, Chile"];

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

function useThemePreference() {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "light";
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (event: MediaQueryListEvent) => {
      setTheme(event.matches ? "dark" : "light");
    };
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return useMemo(
    () => ({
      theme,
      toggle: () => setTheme((current) => (current === "dark" ? "light" : "dark")),
    }),
    [theme],
  );
}

function DoctoraliaBookingWidget() {
  useDoctoraliaScript();

  return (
    <Card className="rounded-3xl" variant="tertiary">
      <Card.Header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-wide text-[color:var(--ink-muted)]">Reserva online</div>
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
          data-zlw-type="button_calendar_medium"
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

function DoctoraliaCertificate() {
  useDoctoraliaScript();

  return (
    <Card className="rounded-3xl" variant="secondary">
      <Card.Header className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-wide text-[color:var(--ink-muted)]">Pacientes satisfechos</div>
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

function LocationSection() {
  return (
    <Card className="rounded-3xl" variant="secondary">
      <Card.Header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-wide text-[color:var(--ink-muted)]">Ubicación</div>
          <Card.Title className="text-2xl">Centro Costanera</Card.Title>
          <Card.Description className="max-w-md text-[color:var(--ink-muted)]">{clinicAddress}</Card.Description>
        </div>
        <Button
          className="rounded-full bg-[var(--accent-2)] text-white"
          onPress={() => window.open(clinicMapUrl, "_blank", "noopener,noreferrer")}
        >
          Cómo llegar
        </Button>
      </Card.Header>
      <Card.Content className="p-0">
        <div className="overflow-hidden rounded-2xl border border-[color:var(--border)]">
          <iframe
            title="Mapa Bioalergia"
            src={clinicMapEmbedUrl}
            className="h-72 w-full"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </Card.Content>
    </Card>
  );
}

const highlights = [
  {
    title: "Diagnóstico preciso",
    copy: "Evaluaciones clínicas y pruebas especializadas para identificar alergias con claridad.",
  },
  {
    title: "Tratamientos modernos",
    copy: "Planes personalizados, inmunoterapia y seguimiento cercano de cada paciente.",
  },
  {
    title: "Acompañamiento continuo",
    copy: "Educación, prevención y control para mejorar la calidad de vida.",
  },
];

export default function App() {
  const { theme, toggle } = useThemePreference();
  const handleDoctoraliaOpen = () => {
    window.open(doctoraliaUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="relative overflow-hidden">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-16">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img
              src="/logo_sin_eslogan.png"
              alt="Bioalergia"
              className="h-12 w-auto sm:h-14 lg:h-16"
              loading="eager"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Chip size="sm" variant="soft">
              Agenda online
            </Chip>
            <Button className="rounded-full bg-[var(--accent)] text-white" onPress={handleDoctoraliaOpen}>
              Agendar cita
            </Button>
            <Button
              className="rounded-full border-[color:var(--border)] text-[color:var(--ink)]"
              variant="outline"
              onPress={toggle}
            >
              {theme === "dark" ? "Modo claro" : "Modo oscuro"}
            </Button>
          </div>
        </header>

        <main className="mt-16 grid gap-12">
          <section className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="flex flex-col gap-6" style={{ animation: "floatIn 0.8s ease-out" }}>
              <div className="flex flex-wrap gap-2">
                {badges.map((badge) => (
                  <Chip key={badge} size="sm" variant="soft">
                    {badge}
                  </Chip>
                ))}
              </div>
              <h1 className="text-4xl font-semibold leading-tight text-[color:var(--ink)] sm:text-6xl">
                Atención especializada en
                <span
                  className="ml-2 block text-5xl font-normal sm:text-6xl"
                  style={{ fontFamily: '"Instrument Serif", serif' }}
                >
                  alergias respiratorias y alimentarias
                </span>
              </h1>
              <p className="max-w-xl text-lg text-[color:var(--ink-muted)]">
                Un enfoque integral para diagnosticar, tratar y acompañar a pacientes con alergias en cada etapa.
              </p>
              <div className="flex flex-wrap gap-4">
                <Button className="rounded-full bg-[var(--accent)] text-white" onPress={handleDoctoraliaOpen}>
                  Reservar evaluación
                </Button>
                <Button className="rounded-full border-[color:var(--border)] text-[color:var(--ink)]" variant="outline">
                  Ver servicios
                </Button>
              </div>
            </div>
            <div style={{ animation: "floatIn 0.9s ease-out" }}>
              <DoctoraliaBookingWidget />
            </div>
          </section>

          <Separator />

          <section className="grid gap-6 lg:grid-cols-3">
            {highlights.map((item, index) => (
              <Card className="rounded-2xl" key={item.title} variant="secondary">
                <Card.Header className="gap-2">
                  <Chip size="sm" variant="soft">
                    0{index + 1}
                  </Chip>
                  <Card.Title>{item.title}</Card.Title>
                  <Card.Description className="text-[color:var(--ink-muted)]">{item.copy}</Card.Description>
                </Card.Header>
              </Card>
            ))}
          </section>

          <section className="grid gap-6 lg:grid-cols-[0.6fr_1fr]">
            <DoctoraliaCertificate />
            <LocationSection />
          </section>

          <Card className="rounded-3xl" variant="secondary">
            <Card.Header className="flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-2">
                <div className="text-xs uppercase tracking-wide text-[color:var(--ink-muted)]">Contacto directo</div>
                <Card.Title className="text-2xl">contacto@bioalergia.cl</Card.Title>
                <Card.Description className="text-[color:var(--ink-muted)]">+56 9 1234 5678</Card.Description>
              </div>
              <Button className="rounded-full bg-[var(--accent-2)] text-white">
                Hablar con el equipo
              </Button>
            </Card.Header>
          </Card>
        </main>
      </div>
    </div>
  );
}
