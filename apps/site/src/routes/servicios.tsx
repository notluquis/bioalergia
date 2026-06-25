import { Alert, Card, Link } from "@heroui/react";
import { createFileRoute } from "@tanstack/react-router";

import { BookingCta } from "@/components/BookingCta";
import { JsonLd } from "@/components/JsonLd";
import { PageShell } from "@/components/PageShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { services } from "@/data/services";
import { breadcrumbJsonLd } from "@/lib/seo";

const QUICK_LINKS = [
  { label: "Exámenes y estudios", href: "/examenes" },
  { label: "Inmunoterapia", href: "/inmunoterapia" },
  { label: "Botiquín del alérgico", href: "/botiquin" },
];

function ServiciosPage() {
  return (
    <PageShell>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Inicio", path: "/" },
          { name: "Servicios", path: "/servicios" },
        ])}
      />
      <PageHeader
        crumbs={[{ label: "Inicio", href: "/" }, { label: "Servicios" }]}
        eyebrow="Servicios"
        lede="Acompañamos todo el proceso de las enfermedades alérgicas: desde el diagnóstico preciso hasta tratamientos que modifican el curso de la enfermedad, con educación y seguimiento cercano. El plan adecuado se define siempre en la consulta médica."
        title="Nuestros servicios"
      />

      <section className="grid gap-6 md:grid-cols-2">
        {services.map((service) => (
          <Card className="rounded-3xl" key={service.title} variant="default">
            <Card.Header className="gap-3">
              <Card.Title className="text-lg">{service.title}</Card.Title>
              <Card.Description className="text-(--ink-muted) leading-relaxed">
                {service.description}
              </Card.Description>
            </Card.Header>
            <Card.Content className="grid gap-3 pb-6">
              {service.points.map((point) => (
                <div className="flex items-start gap-3 text-sm leading-relaxed" key={point}>
                  <span className="mt-2 rounded-full bg-(--accent) size-2" />
                  <span className="text-(--ink-muted)">{point}</span>
                </div>
              ))}
            </Card.Content>
          </Card>
        ))}
      </section>

      <section className="grid gap-4">
        <h2 className="font-display text-[1.75rem] text-foreground sm:text-[2rem]">
          Horario y atención
        </h2>
        <Card className="rounded-3xl" variant="secondary">
          <Card.Header className="gap-2">
            <Card.Title className="text-lg">Horario de atención</Card.Title>
            <Card.Description className="text-(--ink-muted) leading-relaxed">
              Lunes a sábado, 10:00 a 17:00. Atención con cita previa.
            </Card.Description>
          </Card.Header>
          <Card.Content className="pb-6">
            <Alert status="warning">
              <Alert.Content>
                <Alert.Description>
                  Bioalergia no es un servicio de urgencia. Ante una emergencia llama al SAMU 131 o
                  acude al servicio de urgencia más cercano.
                </Alert.Description>
              </Alert.Content>
            </Alert>
          </Card.Content>
        </Card>
      </section>

      <section className="grid gap-4">
        <h2 className="font-display text-[1.75rem] text-foreground sm:text-[2rem]">
          Profundiza en cada área
        </h2>
        <div className="flex flex-wrap gap-3">
          {QUICK_LINKS.map((link) => (
            <Link
              key={link.href}
              className="rounded-full border border-line bg-surface-2 px-5 py-2 font-semibold text-foreground text-sm no-underline transition hover:border-brand-amber hover:text-brand-blue"
              href={link.href}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </section>

      <BookingCta
        title="¿No sabes qué servicio necesitas?"
        description="Agenda una evaluación y definimos juntos el estudio o tratamiento adecuado para tu caso."
        location="servicios_page"
      />
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
