import { Card, Chip, Link, Separator } from "@heroui/react";
import { createFileRoute } from "@tanstack/react-router";

import { BookingCta } from "@/components/BookingCta";
import { JsonLd } from "@/components/JsonLd";
import { PageShell } from "@/components/PageShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { Photo } from "@/components/ui/Photo";
import { fundacionContent } from "@/data/foundation";
import { breadcrumbJsonLd } from "@/lib/seo";

function CompromisoSocialPage() {
  return (
    <PageShell>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Inicio", path: "/" },
          { name: "Compromiso social", path: "/compromiso-social" },
        ])}
      />
      <PageHeader
        crumbs={[{ label: "Inicio", href: "/" }, { label: "Compromiso social" }]}
        eyebrow="Nuestro propósito"
        lede={fundacionContent.intro}
        title="Compromiso social"
      />

      <Photo
        className="h-[clamp(14rem,32vw,22rem)]"
        name="doctorDesk"
        rounded="rounded-3xl"
        sizes="(min-width: 1024px) 1100px, 100vw"
      />

      <section className="grid gap-6 md:grid-cols-2">
        {fundacionContent.values.map((value) => (
          <Card className="rounded-3xl" key={value.title} variant="default">
            <Card.Header className="gap-3">
              <Card.Title className="text-lg">{value.title}</Card.Title>
              <Card.Description className="text-(--ink-muted) leading-relaxed">
                {value.detail}
              </Card.Description>
            </Card.Header>
          </Card>
        ))}
      </section>

      <section className="grid gap-6">
        <div className="grid gap-3">
          <h2 className="font-display text-[1.75rem] text-foreground sm:text-[2rem]">
            Organizaciones y recursos para pacientes
          </h2>
          {/* TODO(user): confirmar antes de publicar cualquier alianza/convenio concreto */}
          <p className="max-w-3xl text-muted text-base leading-relaxed">
            Estas son organizaciones y herramientas externas e independientes que recomendamos a
            nuestros pacientes. No son convenios ni alianzas formales de Bioalergia: orientamos y
            derivamos hacia ellas cuando pueden aportar apoyo, educación o información adicional.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {fundacionContent.resources.map((resource) => (
            <Card className="rounded-3xl" key={resource.name} variant="default">
              <Card.Header className="gap-3">
                <div className="flex items-center justify-between gap-3">
                  <Card.Title className="text-lg">{resource.name}</Card.Title>
                  {resource.external ? (
                    <Chip size="sm" variant="secondary">
                      Externo
                    </Chip>
                  ) : null}
                </div>
                <Card.Description className="text-(--ink-muted) leading-relaxed">
                  {resource.description}
                </Card.Description>
              </Card.Header>
              <Card.Content className="pb-6">
                <Separator className="mb-4" />
                {/* TODO(user): confirmar antes de publicar cualquier alianza/convenio concreto */}
                <Link
                  href={resource.href}
                  {...(resource.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  className="text-brand-blue"
                >
                  Visitar sitio
                  <Link.Icon />
                </Link>
              </Card.Content>
            </Card>
          ))}
        </div>

        <p className="max-w-3xl text-muted text-sm leading-relaxed">
          Recomendar estas organizaciones forma parte de cómo entendemos el acompañamiento: ningún
          paciente debería sentirse solo frente a su diagnóstico. Si necesitas orientación sobre a
          dónde acudir, conversémoslo en tu consulta.
        </p>
      </section>

      <BookingCta
        title="¿Tienes dudas sobre tus alergias?"
        description="Agenda una evaluación y conversemos sobre tu caso, los estudios adecuados y los recursos de apoyo que pueden ayudarte."
        location="compromiso_social_page"
      />
    </PageShell>
  );
}

export const Route = createFileRoute("/compromiso-social")({
  component: CompromisoSocialPage,
  head: () => {
    const origin = typeof window === "undefined" ? "https://bioalergia.cl" : window.location.origin;
    const url = `${origin}/compromiso-social`;
    return {
      meta: [
        { title: "Compromiso social · Bioalergia" },
        {
          name: "description",
          content:
            "El compromiso social de Bioalergia: educación, prevención, acceso a información confiable y acompañamiento del paciente alérgico en Concepción, con recursos de apoyo recomendados.",
        },
        { property: "og:title", content: "Compromiso social · Bioalergia" },
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
