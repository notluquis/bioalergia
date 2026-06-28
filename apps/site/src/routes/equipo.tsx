import { Card, Chip, Link } from "@heroui/react";
import { createFileRoute } from "@tanstack/react-router";

import { BookingCta } from "@/components/BookingCta";
import { JsonLd } from "@/components/JsonLd";
import { PageShell } from "@/components/PageShell";
import { Container } from "@/components/ui/Container";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { PageHero } from "@/components/ui/PageHero";
import { SectionBand } from "@/components/ui/SectionBand";
import { clinicOverview } from "@/data/clinic";
import { team } from "@/data/team";
import { breadcrumbJsonLd, physicianJsonLd } from "@/lib/seo";

function EquipoPage() {
  return (
    <PageShell contained={false}>
      <JsonLd data={physicianJsonLd()} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Inicio", path: "/" },
          { name: "Equipo", path: "/equipo" },
        ])}
      />
      <PageHero
        crumbs={[{ label: "Inicio", href: "/" }, { label: "Equipo" }]}
        eyebrow="Equipo"
        lede="Detrás de Bioalergia hay un equipo que combina experiencia clínica en alergología e inmunología con una gestión cercana y plataformas digitales propias, para ofrecer una atención precisa, ordenada y centrada en cada paciente."
        photo="doctorDesk"
        title="Nuestro equipo"
      />

      <SectionBand borderTop tone="surface2">
        <Eyebrow className="mb-3">Quiénes somos</Eyebrow>
        <h2 className="mb-9 max-w-2xl font-display text-[2rem] leading-[1.05] text-foreground sm:text-[2.5rem]">
          Las personas detrás de Bioalergia.
        </h2>
        <div className="grid gap-6">
          {team.map((member) => (
            <Card
              className="h-full rounded-2xl border border-line bg-surface"
              key={member.name}
              variant="default"
            >
              <Card.Header className="gap-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Card.Title className="font-display text-2xl text-foreground">
                    {member.name}
                  </Card.Title>
                  <Chip size="sm" variant="secondary">
                    {member.badge}
                  </Chip>
                </div>
                <Card.Description className="text-eyebrow text-sm uppercase tracking-[0.18em]">
                  {member.role}
                </Card.Description>
              </Card.Header>
              <Card.Content className="grid gap-4 pb-6">
                {member.paragraphs.map((paragraph) => (
                  <p className="text-base text-muted leading-relaxed" key={paragraph.slice(0, 40)}>
                    {paragraph}
                  </p>
                ))}
                {(member.email || member.linkedin) && (
                  <div className="flex flex-wrap items-center gap-4 border-line border-t pt-4">
                    {member.email ? (
                      <Link
                        className="font-semibold text-brand-blue text-sm no-underline hover:underline"
                        href={`mailto:${member.email}`}
                      >
                        {member.email}
                      </Link>
                    ) : null}
                    {member.linkedin ? (
                      <Link
                        className="font-semibold text-brand-blue text-sm no-underline hover:underline"
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
        </div>
      </SectionBand>

      <SectionBand tone="surface">
        <Eyebrow className="mb-3">Cómo trabajamos</Eyebrow>
        <h2 className="mb-9 max-w-2xl font-display text-[2rem] leading-[1.05] text-foreground sm:text-[2.5rem]">
          Una atención precisa, ordenada y cercana.
        </h2>
        <div className="grid gap-6 md:grid-cols-3">
          {clinicOverview.pillars.map((pillar) => (
            <Card
              className="h-full rounded-2xl border border-line bg-surface-2"
              key={pillar.title}
              variant="default"
            >
              <Card.Header className="gap-3">
                <Card.Title className="font-display text-[1.4rem] text-foreground">
                  {pillar.title}
                </Card.Title>
                <Card.Description className="text-muted leading-relaxed">
                  {pillar.detail}
                </Card.Description>
              </Card.Header>
            </Card>
          ))}
        </div>
      </SectionBand>

      <SectionBand tone="bg">
        <Eyebrow className="mb-3">Nuestro norte</Eyebrow>
        <h2 className="mb-9 max-w-2xl font-display text-[2rem] leading-[1.05] text-foreground sm:text-[2.5rem]">
          Misión y visión.
        </h2>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="h-full rounded-2xl border border-line bg-surface" variant="default">
            <Card.Header className="gap-2">
              <Card.Title className="font-display text-[1.4rem] text-foreground">Misión</Card.Title>
              <Card.Description className="text-muted leading-relaxed">
                {clinicOverview.mission}
              </Card.Description>
            </Card.Header>
          </Card>
          <Card className="h-full rounded-2xl border border-line bg-surface" variant="default">
            <Card.Header className="gap-2">
              <Card.Title className="font-display text-[1.4rem] text-foreground">Visión</Card.Title>
              <Card.Description className="text-muted leading-relaxed">
                {clinicOverview.vision}
              </Card.Description>
            </Card.Header>
          </Card>
        </div>
      </SectionBand>

      <Container className="pb-16">
        <BookingCta
          title="Agenda con nuestro especialista"
          description="Reserva una evaluación y conversa tu caso con el Dr. Martínez. Definimos juntos el estudio y el tratamiento que mejor se adaptan a ti."
          location="equipo_page"
        />
      </Container>
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
