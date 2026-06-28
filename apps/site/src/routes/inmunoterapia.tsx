import { Card, Chip } from "@heroui/react";
import { createFileRoute } from "@tanstack/react-router";

import { BookingCta } from "@/components/BookingCta";
import { JsonLd } from "@/components/JsonLd";
import { PageShell } from "@/components/PageShell";
import { Container } from "@/components/ui/Container";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { PageHero } from "@/components/ui/PageHero";
import { SectionBand } from "@/components/ui/SectionBand";
import { inmunoterapiaContent } from "@/data/immunotherapy";
import { breadcrumbJsonLd } from "@/lib/seo";

function InmunoterapiaPage() {
  return (
    <PageShell contained={false}>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Inicio", path: "/" },
          { name: "Inmunoterapia", path: "/inmunoterapia" },
        ])}
      />

      <PageHero
        crumbs={[{ label: "Inicio", href: "/" }, { label: "Inmunoterapia" }]}
        eyebrow="Tratamiento"
        lede={inmunoterapiaContent.intro}
        photo="scitInjection"
        title="Inmunoterapia para alergias"
      />

      <SectionBand borderTop tone="surface2">
        <div className="mb-9 grid max-w-3xl gap-3">
          <Eyebrow>Modalidades</Eyebrow>
          <h2 className="font-display text-[2rem] leading-[1.05] text-foreground sm:text-[2.5rem]">
            SCIT vs SLIT
          </h2>
          <p className="text-[1.0625rem] leading-[1.6] text-muted">
            Existen dos formas de administrar la inmunoterapia. Elegimos la modalidad adecuada según
            tu diagnóstico, tu edad, tu estilo de vida y criterios de seguridad clínica.
          </p>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          {inmunoterapiaContent.modalities.map((item) => (
            <Card
              className="h-full rounded-2xl border border-line bg-surface"
              key={item.label}
              variant="default"
            >
              <Card.Header className="gap-3 pb-5">
                <Card.Title className="font-display text-[1.4rem] text-foreground">
                  {item.label}
                </Card.Title>
                <Card.Description className="text-muted leading-relaxed">
                  {item.detail}
                </Card.Description>
              </Card.Header>
            </Card>
          ))}
        </div>

        <Card className="mt-6 rounded-2xl border border-line bg-surface" variant="default">
          <Card.Header className="gap-2">
            <Card.Title className="font-display text-[1.4rem] text-foreground">
              Comparativa clínica
            </Card.Title>
            <Card.Description className="text-muted">
              Diferencias clave para tomar una decisión informada junto a tu médico.
            </Card.Description>
          </Card.Header>
          <Card.Content className="overflow-x-auto pb-6 sm:overflow-x-visible">
            <div className="space-y-0">
              <div className="grid grid-cols-1 gap-6 border-line border-b pb-3 sm:grid-cols-3 sm:pb-4">
                <div className="font-semibold text-muted text-xs uppercase tracking-[0.2em]">
                  Aspecto
                </div>
                <div className="font-semibold text-muted text-xs uppercase tracking-[0.2em]">
                  SCIT · subcutánea
                </div>
                <div className="font-semibold text-muted text-xs uppercase tracking-[0.2em]">
                  SLIT · sublingual
                </div>
              </div>

              {inmunoterapiaContent.comparison.map((row, index) => (
                <div
                  key={row.aspect}
                  className={`-mx-4 grid grid-cols-1 gap-6 border-line border-b sm:grid-cols-3 p-4 ${
                    index % 2 === 0 ? "bg-surface-2" : ""
                  }`}
                >
                  <div className="font-semibold text-foreground text-sm sm:text-base">
                    {row.aspect}
                  </div>
                  <div className="text-muted text-sm">{row.scit}</div>
                  <div className="text-muted text-sm">{row.slit}</div>
                </div>
              ))}
            </div>
          </Card.Content>
        </Card>
      </SectionBand>

      <SectionBand tone="surface">
        <div className="mb-9 grid max-w-3xl gap-3">
          <Eyebrow>Alcance</Eyebrow>
          <h2 className="font-display text-[2rem] leading-[1.05] text-foreground sm:text-[2.5rem]">
            Alérgenos que tratamos
          </h2>
          <p className="text-[1.0625rem] leading-[1.6] text-muted">
            La inmunoterapia puede indicarse frente a distintos alérgenos respiratorios y, en casos
            seleccionados, a veneno de insectos. Estos son los más frecuentes.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {inmunoterapiaContent.allergens.map((allergen) => (
            <Card
              className="h-full rounded-2xl border border-line bg-surface"
              key={allergen.name}
              variant="default"
            >
              <Card.Header className="gap-3">
                <Card.Title className="font-display text-[1.4rem] text-foreground">
                  {allergen.name}
                </Card.Title>
                <Card.Description className="text-muted leading-relaxed">
                  {allergen.detail}
                </Card.Description>
              </Card.Header>
            </Card>
          ))}
        </div>
      </SectionBand>

      <SectionBand tone="bg">
        <div className="mb-9 grid max-w-3xl gap-3">
          <Eyebrow>A quién</Eyebrow>
          <h2 className="font-display text-[2rem] leading-[1.05] text-foreground sm:text-[2.5rem]">
            Consideraciones por edad
          </h2>
          <p className="text-[1.0625rem] leading-[1.6] text-muted">
            La inmunoterapia se evalúa de forma individual. Estas son orientaciones generales que
            siempre se confirman en la consulta.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {inmunoterapiaContent.ages.map((age) => (
            <Card
              className="h-full rounded-2xl border border-line bg-surface"
              key={age.label}
              variant="default"
            >
              <Card.Header className="gap-3">
                <div className="flex items-center justify-between gap-3">
                  <Card.Title className="font-display text-[1.4rem] text-foreground">
                    {age.label}
                  </Card.Title>
                  <Chip size="sm" variant="secondary">
                    Edad
                  </Chip>
                </div>
                <Card.Description className="text-muted leading-relaxed">
                  {age.detail}
                </Card.Description>
              </Card.Header>
            </Card>
          ))}
        </div>
      </SectionBand>

      <SectionBand tone="surface2">
        <div className="mb-9 grid max-w-3xl gap-3">
          <Eyebrow>Por qué tratar</Eyebrow>
          <h2 className="font-display text-[2rem] leading-[1.05] text-foreground sm:text-[2.5rem]">
            Beneficios de la inmunoterapia
          </h2>
          <p className="text-[1.0625rem] leading-[1.6] text-muted">
            Un tratamiento modificador de la enfermedad, con impacto sostenido en el tiempo.
          </p>
        </div>
        <Card className="rounded-2xl border border-line bg-surface" variant="default">
          <Card.Content className="grid gap-4 py-6">
            {inmunoterapiaContent.benefits.map((benefit) => (
              <div className="flex items-start gap-3 text-sm leading-relaxed" key={benefit}>
                <span className="mt-2 size-2 rounded-full bg-brand-amber" />
                <span className="text-muted">{benefit}</span>
              </div>
            ))}
          </Card.Content>
        </Card>
      </SectionBand>

      <SectionBand tone="surface">
        <div className="mb-9 grid max-w-3xl gap-3">
          <Eyebrow>Dudas frecuentes</Eyebrow>
          <h2 className="font-display text-[2rem] leading-[1.05] text-foreground sm:text-[2.5rem]">
            Preguntas frecuentes
          </h2>
        </div>
        <div className="grid gap-4">
          {inmunoterapiaContent.faq.map((faq) => (
            <Card
              className="rounded-2xl border border-line bg-surface"
              key={faq.question}
              variant="default"
            >
              <Card.Header className="gap-3">
                <Card.Title className="font-display text-[1.2rem] font-semibold text-foreground">
                  {faq.question}
                </Card.Title>
                <Card.Description className="text-muted leading-relaxed">
                  {faq.answer}
                </Card.Description>
              </Card.Header>
            </Card>
          ))}
        </div>
      </SectionBand>

      <Container className="pb-16">
        <BookingCta
          title="¿La inmunoterapia es para ti?"
          description="Agenda una evaluación con nuestro equipo en Concepción. Revisamos tu historia clínica y diagnóstico para definir si la inmunoterapia y la modalidad adecuada se ajustan a tu caso."
          location="inmunoterapia_page"
        />
      </Container>
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
        { property: "og:image", content: `${origin}/og-image.png` },
        { name: "twitter:image", content: `${origin}/og-image.png` },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
});
