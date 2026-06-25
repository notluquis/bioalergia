import { Card, Chip } from "@heroui/react";
import { createFileRoute } from "@tanstack/react-router";

import { BookingCta } from "@/components/BookingCta";
import { JsonLd } from "@/components/JsonLd";
import { PageShell } from "@/components/PageShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { Photo } from "@/components/ui/Photo";
import { inmunoterapiaContent } from "@/data/immunotherapy";
import { breadcrumbJsonLd } from "@/lib/seo";
import { Section } from "@/sections/Section";

function InmunoterapiaPage() {
  return (
    <PageShell>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Inicio", path: "/" },
          { name: "Inmunoterapia", path: "/inmunoterapia" },
        ])}
      />
      <PageHeader
        crumbs={[{ label: "Inicio", href: "/" }, { label: "Inmunoterapia" }]}
        eyebrow="Tratamiento"
        lede={inmunoterapiaContent.intro}
        title="Inmunoterapia para alergias"
      />

      <Photo
        className="h-[clamp(14rem,32vw,22rem)]"
        name="scitInjection"
        rounded="rounded-3xl"
        sizes="(min-width: 1024px) 1100px, 100vw"
      />

      <Section
        eyebrow="Modalidades"
        subtitle="Existen dos formas de administrar la inmunoterapia. Elegimos la modalidad adecuada según tu diagnóstico, tu edad, tu estilo de vida y criterios de seguridad clínica."
        title="SCIT vs SLIT"
      >
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
      </Section>

      <Section
        eyebrow="Alcance"
        subtitle="La inmunoterapia puede indicarse frente a distintos alérgenos respiratorios y, en casos seleccionados, a veneno de insectos. Estos son los más frecuentes."
        title="Alérgenos que tratamos"
      >
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
      </Section>

      <Section
        eyebrow="A quién"
        subtitle="La inmunoterapia se evalúa de forma individual. Estas son orientaciones generales que siempre se confirman en la consulta."
        title="Consideraciones por edad"
      >
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
      </Section>

      <Card className="rounded-3xl" variant="secondary">
        <Card.Header className="gap-3">
          <Card.Title className="text-xl">Beneficios de la inmunoterapia</Card.Title>
          <Card.Description className="text-muted">
            Un tratamiento modificador de la enfermedad, con impacto sostenido en el tiempo.
          </Card.Description>
        </Card.Header>
        <Card.Content className="grid gap-4 pb-6">
          {inmunoterapiaContent.benefits.map((benefit) => (
            <div className="flex items-start gap-3 text-sm leading-relaxed" key={benefit}>
              <span className="mt-2 rounded-full bg-brand-amber size-2" />
              <span className="text-muted">{benefit}</span>
            </div>
          ))}
        </Card.Content>
      </Card>

      <Section eyebrow="Dudas frecuentes" title="Preguntas frecuentes">
        <div className="grid gap-4">
          {inmunoterapiaContent.faq.map((faq) => (
            <Card className="rounded-3xl" key={faq.question} variant="default">
              <Card.Header className="gap-3">
                <Card.Title className="text-base font-semibold text-foreground">
                  {faq.question}
                </Card.Title>
                <Card.Description className="text-(--ink-muted) leading-relaxed">
                  {faq.answer}
                </Card.Description>
              </Card.Header>
            </Card>
          ))}
        </div>
      </Section>

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
        { property: "og:image", content: `${origin}/og-image.png` },
        { name: "twitter:image", content: `${origin}/og-image.png` },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
});
