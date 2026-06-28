import { Alert, Card, Link } from "@heroui/react";
import { createFileRoute } from "@tanstack/react-router";

import { BookingCta } from "@/components/BookingCta";
import { JsonLd } from "@/components/JsonLd";
import { PageShell } from "@/components/PageShell";
import { Container } from "@/components/ui/Container";
import { ctaClass } from "@/components/ui/cta";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { PageHero } from "@/components/ui/PageHero";
import { SectionBand } from "@/components/ui/SectionBand";
import { contactInfo } from "@/data/clinic";
import { services } from "@/data/services";
import { breadcrumbJsonLd } from "@/lib/seo";

const QUICK_LINKS = [
  { label: "Exámenes y estudios", href: "/examenes" },
  { label: "Inmunoterapia", href: "/inmunoterapia" },
  { label: "Botiquín del alérgico", href: "/botiquin" },
];

function ServiciosPage() {
  return (
    <PageShell contained={false}>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Inicio", path: "/" },
          { name: "Servicios", path: "/servicios" },
        ])}
      />

      <PageHero
        crumbs={[{ label: "Inicio", href: "/" }, { label: "Servicios" }]}
        eyebrow="Servicios"
        lede="Acompañamos todo el proceso de las enfermedades alérgicas: desde el diagnóstico preciso hasta tratamientos que modifican el curso de la enfermedad, con educación y seguimiento cercano. El plan adecuado se define siempre en la consulta médica."
        photo="prickArm"
        title="Nuestros servicios"
      />

      <SectionBand borderTop tone="surface2">
        <Eyebrow className="mb-3">Lo que hacemos</Eyebrow>
        <h2 className="mb-9 max-w-2xl font-display text-[2rem] leading-[1.05] text-foreground sm:text-[2.5rem]">
          Todo lo de tu alergia, en un solo lugar.
        </h2>
        <div className="grid gap-6 md:grid-cols-2">
          {services.map((service) => (
            <Card
              className="h-full rounded-2xl border border-line bg-surface"
              key={service.title}
              variant="default"
            >
              <Card.Header className="gap-3">
                <Card.Title className="font-display text-[1.4rem] text-foreground">
                  {service.title}
                </Card.Title>
                <Card.Description className="text-muted leading-relaxed">
                  {service.description}
                </Card.Description>
              </Card.Header>
              <Card.Content className="grid gap-3 pb-6">
                {service.points.map((point) => (
                  <div className="flex items-start gap-3 text-sm leading-relaxed" key={point}>
                    <span className="mt-2 size-2 rounded-full bg-brand-amber" />
                    <span className="text-muted">{point}</span>
                  </div>
                ))}
              </Card.Content>
            </Card>
          ))}
        </div>
      </SectionBand>

      <SectionBand tone="surface">
        <div className="grid items-start gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <Eyebrow className="mb-3">Atención</Eyebrow>
            <h2 className="font-display text-[1.75rem] leading-[1.1] text-foreground sm:text-[2rem]">
              Horario y cómo atendemos.
            </h2>
          </div>
          <div className="grid gap-5">
            <div className="rounded-2xl border border-line bg-surface-2 p-6">
              <div className="font-bold text-foreground">Horario de atención</div>
              <p className="mt-1 text-muted">
                {contactInfo.hours}. {contactInfo.hoursNote} (con cita previa).
              </p>
            </div>
            <Alert status="warning">
              <Alert.Content>
                <Alert.Description>
                  Bioalergia no es un servicio de urgencia. Ante una emergencia llama al SAMU 131 o
                  acude al servicio de urgencia más cercano.
                </Alert.Description>
              </Alert.Content>
            </Alert>
          </div>
        </div>
      </SectionBand>

      <SectionBand tone="bg">
        <Eyebrow className="mb-4">Profundiza en cada área</Eyebrow>
        <div className="flex flex-wrap gap-3">
          {QUICK_LINKS.map((link) => (
            <Link
              className={ctaClass("outline", "rounded-full px-5 py-2")}
              href={link.href}
              key={link.href}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </SectionBand>

      <Container className="pb-16">
        <BookingCta
          description="Agenda una evaluación y definimos juntos el estudio o tratamiento adecuado para tu caso."
          location="servicios_page"
          title="¿No sabes qué servicio necesitas?"
        />
      </Container>
    </PageShell>
  );
}

export const Route = createFileRoute("/servicios")({
  component: ServiciosPage,
  head: () => {
    const origin = typeof window === "undefined" ? "https://bioalergia.cl" : window.location.origin;
    const url = `${origin}/servicios`;
    return {
      meta: [
        { title: "Servicios · Bioalergia" },
        {
          name: "description",
          content:
            "Diagnóstico integral de alergias, inmunoterapia subcutánea (SCIT) y sublingual (SLIT), y control ambiental. Atención alergológica en Concepción.",
        },
        { property: "og:title", content: "Servicios · Bioalergia" },
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
