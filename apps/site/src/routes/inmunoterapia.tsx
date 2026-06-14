import { Breadcrumbs, Card, Chip } from "@heroui/react";
import { createFileRoute } from "@tanstack/react-router";

import { BookingCta } from "@/components/BookingCta";
import { PageShell } from "@/components/PageShell";
import { inmunoterapiaContent } from "@/data/immunotherapy";

function InmunoterapiaPage() {
  return (
    <PageShell>
      <section className="grid gap-4">
        <Breadcrumbs>
          <Breadcrumbs.Item href="/">Inicio</Breadcrumbs.Item>
          <Breadcrumbs.Item>Inmunoterapia</Breadcrumbs.Item>
        </Breadcrumbs>
        <div className="grid gap-3">
          <div className="text-(--ink-muted) text-xs uppercase tracking-[0.2em]">Tratamiento</div>
          <h1 className="font-semibold text-(--ink) text-3xl sm:text-4xl">
            Inmunoterapia para alergias
          </h1>
          <p className="max-w-3xl text-(--ink-muted) text-base leading-relaxed sm:text-lg">
            {inmunoterapiaContent.intro}
          </p>
        </div>
      </section>
      <section className="grid gap-6">
        <div className="grid gap-3">
          <div className="text-(--ink-muted) text-xs uppercase tracking-[0.2em]">Modalidades</div>
          <h2 className="font-semibold text-(--ink) text-2xl sm:text-3xl">SCIT vs SLIT</h2>
          <p className="max-w-3xl text-(--ink-muted) leading-relaxed">
            Existen dos formas de administrar la inmunoterapia. Elegimos la modalidad adecuada según
            tu diagnóstico, tu edad, tu estilo de vida y criterios de seguridad clínica.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {inmunoterapiaContent.modalities.map((item) => (
            <Card className="rounded-3xl" key={item.label} variant="default">
              <Card.Header className="gap-3 pb-5">
                <Card.Title className="text-lg">{item.label}</Card.Title>
                <Card.Description className="text-(--ink-muted) leading-relaxed">
                  {item.detail}
                </Card.Description>
              </Card.Header>
            </Card>
          ))}
        </div>

        <Card className="rounded-3xl" variant="default">
          <Card.Header className="gap-2">
            <Card.Title className="text-xl">Comparativa clínica</Card.Title>
            <Card.Description className="text-(--ink-muted)">
              Diferencias clave para tomar una decisión informada junto a tu médico.
            </Card.Description>
          </Card.Header>
          <Card.Content className="overflow-x-auto pb-6 sm:overflow-x-visible">
            <div className="space-y-0">
              <div className="grid grid-cols-1 gap-6 border-border border-b pb-3 sm:grid-cols-3 sm:pb-4">
                <div className="font-semibold text-(--ink-muted) text-xs uppercase tracking-[0.2em]">
                  Aspecto
                </div>
                <div className="font-semibold text-(--ink-muted) text-xs uppercase tracking-[0.2em]">
                  SCIT · subcutánea
                </div>
                <div className="font-semibold text-(--ink-muted) text-xs uppercase tracking-[0.2em]">
                  SLIT · sublingual
                </div>
              </div>

              {inmunoterapiaContent.comparison.map((row, index) => (
                <div
                  key={row.aspect}
                  className={`-mx-4 grid grid-cols-1 gap-6 border-border border-b sm:grid-cols-3 p-4 ${
                    index % 2 === 0 ? "bg-(--surface-2)" : ""
                  }`}
                >
                  <div className="font-semibold text-(--ink) text-sm sm:text-base">
                    {row.aspect}
                  </div>
                  <div className="text-(--ink-muted) text-sm">{row.scit}</div>
                  <div className="text-(--ink-muted) text-sm">{row.slit}</div>
                </div>
              ))}
            </div>
          </Card.Content>
        </Card>
      </section>

      <section className="grid gap-6">
        <div className="grid gap-3">
          <div className="text-(--ink-muted) text-xs uppercase tracking-[0.2em]">Alcance</div>
          <h2 className="font-semibold text-(--ink) text-2xl sm:text-3xl">
            Alérgenos que tratamos
          </h2>
          <p className="max-w-3xl text-(--ink-muted) leading-relaxed">
            La inmunoterapia puede indicarse frente a distintos alérgenos respiratorios y, en casos
            seleccionados, a veneno de insectos. Estos son los más frecuentes.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {inmunoterapiaContent.allergens.map((allergen) => (
            <Card className="rounded-3xl" key={allergen.name} variant="default">
              <Card.Header className="gap-3">
                <Card.Title className="text-lg">{allergen.name}</Card.Title>
                <Card.Description className="text-(--ink-muted) leading-relaxed">
                  {allergen.detail}
                </Card.Description>
              </Card.Header>
            </Card>
          ))}
        </div>
      </section>

      <section className="grid gap-6">
        <div className="grid gap-3">
          <div className="text-(--ink-muted) text-xs uppercase tracking-[0.2em]">A quién</div>
          <h2 className="font-semibold text-(--ink) text-2xl sm:text-3xl">
            Consideraciones por edad
          </h2>
          <p className="max-w-3xl text-(--ink-muted) leading-relaxed">
            La inmunoterapia se evalúa de forma individual. Estas son orientaciones generales que
            siempre se confirman en la consulta.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {inmunoterapiaContent.ages.map((age) => (
            <Card className="rounded-3xl" key={age.label} variant="default">
              <Card.Header className="gap-3">
                <div className="flex items-center justify-between gap-3">
                  <Card.Title className="text-lg">{age.label}</Card.Title>
                  <Chip size="sm" variant="secondary">
                    Edad
                  </Chip>
                </div>
                <Card.Description className="text-(--ink-muted) leading-relaxed">
                  {age.detail}
                </Card.Description>
              </Card.Header>
            </Card>
          ))}
        </div>
      </section>

      <Card className="rounded-3xl" variant="secondary">
        <Card.Header className="gap-3">
          <Card.Title className="text-xl">Beneficios de la inmunoterapia</Card.Title>
          <Card.Description className="text-(--ink-muted)">
            Un tratamiento modificador de la enfermedad, con impacto sostenido en el tiempo.
          </Card.Description>
        </Card.Header>
        <Card.Content className="grid gap-4 pb-6">
          {inmunoterapiaContent.benefits.map((benefit) => (
            <div className="flex items-start gap-3 text-sm leading-relaxed" key={benefit}>
              <span className="mt-2 rounded-full bg-(--accent) size-2" />
              <span className="text-(--ink-muted)">{benefit}</span>
            </div>
          ))}
        </Card.Content>
      </Card>

      <section className="grid gap-6">
        <div className="grid gap-3">
          <div className="text-(--ink-muted) text-xs uppercase tracking-[0.2em]">
            Dudas frecuentes
          </div>
          <h2 className="font-semibold text-(--ink) text-2xl sm:text-3xl">Preguntas frecuentes</h2>
        </div>

        <div className="grid gap-4">
          {inmunoterapiaContent.faq.map((faq) => (
            <Card className="rounded-3xl" key={faq.question} variant="default">
              <Card.Header className="gap-3">
                <Card.Title className="text-base font-semibold text-(--ink)">
                  {faq.question}
                </Card.Title>
                <Card.Description className="text-(--ink-muted) leading-relaxed">
                  {faq.answer}
                </Card.Description>
              </Card.Header>
            </Card>
          ))}
        </div>
      </section>

      <BookingCta
        title="¿La inmunoterapia es para ti?"
        description="Agenda una evaluación con nuestro equipo en Concepción. Revisamos tu historia clínica y diagnóstico para definir si la inmunoterapia y la modalidad adecuada se ajustan a tu caso."
        location="inmunoterapia_page"
      />
    </PageShell>
  );
}

export const Route = createFileRoute("/inmunoterapia")({
  component: InmunoterapiaPage,
  head: () => {
    const origin = typeof window === "undefined" ? "https://bioalergia.cl" : window.location.origin;
    const url = `${origin}/inmunoterapia`;
    return {
      meta: [
        { title: "Inmunoterapia · Bioalergia" },
        {
          name: "description",
          content:
            "Inmunoterapia subcutánea (SCIT) y sublingual (SLIT) para alergias respiratorias y veneno de insectos. Tratamiento que modifica el curso de la enfermedad alérgica en Concepción.",
        },
        { property: "og:title", content: "Inmunoterapia · Bioalergia" },
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
});
