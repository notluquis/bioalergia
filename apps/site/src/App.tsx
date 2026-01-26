import { useEffect } from "react";

const badges = ["Alergología", "Inmunología", "Adultos y niños", "Santiago, Chile"];


function DoctoraliaWidget() {
  useEffect(() => {
    const existing = document.getElementById("zl-widget-s");
    if (existing) return;

    const script = document.createElement("script");
    script.id = "zl-widget-s";
    script.src = "//platform.docplanner.com/js/widget.js";
    script.async = true;
    document.body.appendChild(script);
  }, []);

  return (
    <div className="rounded-3xl border border-black/10 bg-white/80 p-6 shadow-[0_20px_60px_-40px_rgba(15,28,38,0.45)]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-wide text-black/50">Reserva online</div>
          <h3 className="mt-2 text-2xl font-semibold">Agenda tu cita en Doctoralia</h3>
          <p className="mt-2 max-w-xl text-sm text-black/70">
            Disponibilidad actualizada en tiempo real y confirmacion por correo.
          </p>
        </div>
        <span className="hidden rounded-full border border-black/10 bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-wide sm:inline-flex">
          Agenda inmediata
        </span>
      </div>

      <div className="mt-6">
        <a
          id="zl-url"
          className="zl-url"
          href="https://www.doctoralia.cl/jose-manuel-martinez-martinez/inmunologo-alergologo/concepcion"
          rel="nofollow"
          data-zlw-doctor="jose-manuel-martinez-martinez"
          data-zlw-type="big_with_calendar"
          data-zlw-opinion="false"
          data-zlw-hide-branding="true"
          data-zlw-saas-only="true"
          data-zlw-a11y-title="Widget de reserva de citas medicas"
        >
          Jose Manuel Martinez Martinez - Doctoralia.cl
        </a>
        <noscript>
          <a href="https://www.doctoralia.cl/jose-manuel-martinez-martinez/inmunologo-alergologo/concepcion">
            Ver disponibilidad en Doctoralia
          </a>
        </noscript>
      </div>
    </div>
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
  return (
    <div className="relative overflow-hidden">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-16">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="text-lg font-semibold tracking-wide">Bioalergia</div>
          <div className="flex items-center gap-3 text-sm">
            <span className="rounded-full border border-black/10 bg-white/70 px-3 py-1">Agenda online</span>
            <button
              className="rounded-full bg-[var(--ink)] px-4 py-2 text-sm font-semibold text-white transition hover:translate-y-[-1px]"
              type="button"
            >
              Agendar cita
            </button>
          </div>
        </header>

        <main className="mt-16 grid gap-12">
          <section className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="flex flex-col gap-6" style={{ animation: "floatIn 0.8s ease-out" }}>
              <div className="flex flex-wrap gap-2">
                {badges.map((badge) => (
                  <span
                    key={badge}
                    className="rounded-full border border-black/10 bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-wide"
                  >
                    {badge}
                  </span>
                ))}
              </div>
              <h1 className="text-4xl font-semibold leading-tight text-[var(--ink)] sm:text-5xl">
                Atención especializada en
                <span
                  className="ml-2 block text-5xl font-normal sm:text-6xl"
                  style={{ fontFamily: '"Instrument Serif", serif' }}
                >
                  alergias respiratorias y alimentarias
                </span>
              </h1>
              <p className="max-w-xl text-lg text-black/70">
                Un enfoque integral para diagnosticar, tratar y acompañar a pacientes con alergias en cada etapa.
              </p>
              <div className="flex flex-wrap gap-4">
                <button
                  className="rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white transition hover:translate-y-[-1px]"
                  type="button"
                >
                  Reservar evaluación
                </button>
                <button
                  className="rounded-full border border-black/15 bg-white/70 px-6 py-3 text-sm font-semibold text-black/80 transition hover:translate-y-[-1px]"
                  type="button"
                >
                  Ver servicios
                </button>
              </div>
            </div>
            <div
              className="rounded-3xl border border-black/10 bg-white/70 p-6 shadow-[0_30px_80px_-40px_rgba(15,28,38,0.5)]"
              style={{ animation: "floatIn 0.9s ease-out" }}
            >
              <div className="grid gap-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-black/50">Disponibilidad</span>
                  <span className="font-semibold text-[var(--accent-2)]">Semana actual</span>
                </div>
                <div className="grid gap-2">
                  {[
                    "Lun 10:00 · Control de alergias",
                    "Mié 16:30 · Evaluación inicial",
                    "Vie 12:00 · Seguimiento",
                  ].map((slot) => (
                    <div
                      key={slot}
                      className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-medium"
                    >
                      {slot}
                    </div>
                  ))}
                </div>
                <div className="rounded-2xl bg-[var(--ink)]/90 px-4 py-3 text-sm text-white">
                  <div className="text-xs uppercase tracking-wide text-white/70">Ubicación</div>
                  <div className="mt-1 font-semibold">Providencia, Santiago</div>
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-3">
            {highlights.map((item, index) => (
              <div
                key={item.title}
                className="rounded-2xl border border-black/10 bg-white/80 p-6"
                style={{ animation: `floatIn 0.${index + 8}s ease-out` }}
              >
                <div className="text-sm font-semibold text-[var(--accent-2)]">0{index + 1}</div>
                <h3 className="mt-3 text-xl font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm text-black/70">{item.copy}</p>
              </div>
            ))}
          </section>

          <section>
            <DoctoraliaWidget />
          </section>

          <section className="rounded-3xl border border-black/10 bg-white/70 p-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-sm uppercase tracking-wide text-black/50">Contacto directo</div>
                <div className="mt-2 text-2xl font-semibold">contacto@bioalergia.cl</div>
                <div className="mt-1 text-sm text-black/60">+56 9 1234 5678</div>
              </div>
              <button
                className="rounded-full bg-[var(--ink)] px-6 py-3 text-sm font-semibold text-white"
                type="button"
              >
                Hablar con el equipo
              </button>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
