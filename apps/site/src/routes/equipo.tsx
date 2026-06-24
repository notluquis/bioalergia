import { Breadcrumbs, Card, Chip, Link } from "@heroui/react";
import { createFileRoute } from "@tanstack/react-router";

import { BookingCta } from "@/components/BookingCta";
import { JsonLd } from "@/components/JsonLd";
import { PageShell } from "@/components/PageShell";
import { clinicOverview } from "@/data/clinic";
import { team } from "@/data/team";
import { breadcrumbJsonLd, physicianJsonLd } from "@/lib/seo";

function EquipoPage() {
  return (
    <PageShell>
      <JsonLd data={physicianJsonLd()} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Inicio", path: "/" },
          { name: "Equipo", path: "/equipo" },
        ])}
      />
      <section className="grid gap-4">
        <Breadcrumbs>
          <Breadcrumbs.Item href="/">Inicio</Breadcrumbs.Item>
          <Breadcrumbs.Item>Equipo</Breadcrumbs.Item>
        </Breadcrumbs>
        <div className="grid gap-3">
          <div className="text-(--ink-muted) text-xs uppercase tracking-[0.2em]">Equipo</div>
          <h1 className="font-semibold text-(--ink) text-3xl sm:text-4xl">Nuestro equipo</h1>
          <p className="max-w-3xl text-(--ink-muted) text-base leading-relaxed sm:text-lg">
            Detrás de Bioalergia hay un equipo que combina experiencia clínica en alergología e
            inmunología con una gestión cercana y plataformas digitales propias, para ofrecer una
            atención precisa, ordenada y centrada en cada paciente.
          </p>
        </div>
      </section>

      <section className="grid gap-6">
        {team.map((member) => (
          <Card className="rounded-3xl" key={member.name} variant="default">
            <Card.Header className="gap-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Card.Title className="text-2xl">{member.name}</Card.Title>
                <Chip size="sm" variant="secondary">
                  {member.badge}
                </Chip>
              </div>
              <Card.Description className="text-(--ink-muted) text-sm uppercase tracking-[0.18em]">
                {member.role}
              </Card.Description>
            </Card.Header>
            <Card.Content className="grid gap-4 pb-6">
              {member.paragraphs.map((paragraph) => (
                <p
                  className="text-(--ink-muted) text-base leading-relaxed"
                  key={paragraph.slice(0, 40)}
                >
                  {paragraph}
                </p>
              ))}
              {(member.email || member.linkedin) && (
                <div className="flex flex-wrap items-center gap-4 border-border border-t pt-4">
                  {member.email ? (
                    <Link
                      className="font-medium text-(--accent) text-sm no-underline hover:underline"
                      href={`mailto:${member.email}`}
                    >
                      {member.email}
                    </Link>
                  ) : null}
                  {member.linkedin ? (
                    <Link
                      className="font-medium text-(--accent) text-sm no-underline hover:underline"
                      href={member.linkedin}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      LinkedIn
                      <Link.Icon />
                    </Link>
                  ) : null}
                </div>
              )}
            </Card.Content>
          </Card>
        ))}
      </section>

      <section className="grid gap-6">
        <h2 className="font-semibold text-(--ink) text-2xl">Cómo trabajamos</h2>
        <div className="grid gap-6 md:grid-cols-3">
          {clinicOverview.pillars.map((pillar) => (
            <Card className="rounded-3xl" key={pillar.title} variant="default">
              <Card.Header className="gap-3">
                <Card.Title className="text-lg">{pillar.title}</Card.Title>
                <Card.Description className="text-(--ink-muted) leading-relaxed">
                  {pillar.detail}
                </Card.Description>
              </Card.Header>
            </Card>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-3xl" variant="secondary">
          <Card.Header className="gap-2">
            <Card.Title className="text-lg">Misión</Card.Title>
            <Card.Description className="text-(--ink-muted) leading-relaxed">
              {clinicOverview.mission}
            </Card.Description>
          </Card.Header>
        </Card>
        <Card className="rounded-3xl" variant="secondary">
          <Card.Header className="gap-2">
            <Card.Title className="text-lg">Visión</Card.Title>
            <Card.Description className="text-(--ink-muted) leading-relaxed">
              {clinicOverview.vision}
            </Card.Description>
          </Card.Header>
        </Card>
      </section>

      <BookingCta
        title="Agenda con nuestro especialista"
        description="Reserva una evaluación y conversa tu caso con el Dr. Martínez. Definimos juntos el estudio y el tratamiento que mejor se adaptan a ti."
        location="equipo_page"
      />
    </PageShell>
  );
}

export const Route = createFileRoute("/equipo")({
  component: EquipoPage,
  head: () => {
    const origin = typeof window === "undefined" ? "https://bioalergia.cl" : window.location.origin;
    const url = `${origin}/equipo`;
    return {
      meta: [
        { title: "Nuestro equipo · Bioalergia" },
        {
          name: "description",
          content:
            "Conoce al equipo de Bioalergia: el Dr. José Manuel Martínez, alergólogo e inmunólogo en Concepción, y el equipo de coordinación y desarrollo que sostiene la clínica.",
        },
        { property: "og:title", content: "Nuestro equipo · Bioalergia" },
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
