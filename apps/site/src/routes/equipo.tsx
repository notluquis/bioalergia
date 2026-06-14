import { Breadcrumbs, Card, Chip } from "@heroui/react";
import { createFileRoute } from "@tanstack/react-router";

import { BookingCta } from "@/components/BookingCta";
import { PageShell } from "@/components/PageShell";
import { clinicOverview } from "@/data/clinic";
import { founderProfile } from "@/data/founder";

function EquipoPage() {
  return (
    <PageShell>
      <section className="grid gap-4">
        <Breadcrumbs>
          <Breadcrumbs.Item href="/">Inicio</Breadcrumbs.Item>
          <Breadcrumbs.Item>Equipo</Breadcrumbs.Item>
        </Breadcrumbs>
        <div className="grid gap-3">
          <div className="text-(--ink-muted) text-xs uppercase tracking-[0.2em]">Equipo</div>
          <h1 className="font-semibold text-(--ink) text-3xl sm:text-4xl">Nuestro especialista</h1>
          <p className="max-w-3xl text-(--ink-muted) text-base leading-relaxed sm:text-lg">
            Detrás de Bioalergia hay una trayectoria clínica dedicada a la alergología y la
            inmunología, con formación nacional e internacional y un compromiso con la atención
            cercana y basada en evidencia.
          </p>
        </div>
      </section>

      <section className="grid gap-6">
        <Card className="rounded-3xl" variant="default">
          <Card.Header className="gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Card.Title className="text-2xl">{founderProfile.name}</Card.Title>
              <Chip size="sm" variant="secondary">
                Fundador y director
              </Chip>
            </div>
          </Card.Header>
          <Card.Content className="grid gap-4 pb-6">
            {founderProfile.paragraphs.map((paragraph) => (
              <p className="text-(--ink-muted) text-base leading-relaxed" key={paragraph.slice(0, 40)}>
                {paragraph}
              </p>
            ))}
          </Card.Content>
        </Card>
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
        { title: "Nuestro especialista · Bioalergia" },
        {
          name: "description",
          content:
            "Conoce al equipo de Bioalergia: el Dr. José Manuel Martínez, alergólogo e inmunólogo en Concepción, con formación nacional e internacional en inmunoterapia y enfermedades alérgicas.",
        },
        { property: "og:title", content: "Nuestro especialista · Bioalergia" },
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
});
