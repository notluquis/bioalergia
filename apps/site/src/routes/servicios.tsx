import { Breadcrumbs, Card, Link } from "@heroui/react";
import { createFileRoute } from "@tanstack/react-router";

import { BookingCta } from "@/components/BookingCta";
import { JsonLd } from "@/components/JsonLd";
import { PageShell } from "@/components/PageShell";
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
      <section className="grid gap-4">
        <Breadcrumbs>
          <Breadcrumbs.Item href="/">Inicio</Breadcrumbs.Item>
          <Breadcrumbs.Item>Servicios</Breadcrumbs.Item>
        </Breadcrumbs>
        <div className="grid gap-3">
          <div className="text-(--ink-muted) text-xs uppercase tracking-[0.2em]">Servicios</div>
          <h1 className="font-semibold text-(--ink) text-3xl sm:text-4xl">Nuestros servicios</h1>
          <p className="max-w-3xl text-(--ink-muted) text-base leading-relaxed sm:text-lg">
            Acompañamos todo el proceso de las enfermedades alérgicas: desde el diagnóstico preciso
            hasta tratamientos que modifican el curso de la enfermedad, con educación y seguimiento
            cercano. El plan adecuado se define siempre en la consulta médica.
          </p>
        </div>
      </section>

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
        <h2 className="font-semibold text-(--ink) text-2xl">Profundiza en cada área</h2>
        <div className="flex flex-wrap gap-3">
          {QUICK_LINKS.map((link) => (
            <Link
              key={link.href}
              className="rounded-full border border-border bg-(--surface-2) px-5 py-2 font-medium text-(--ink) text-sm no-underline transition hover:bg-(--accent) hover:text-white"
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
