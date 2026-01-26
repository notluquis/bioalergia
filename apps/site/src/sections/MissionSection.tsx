import { Card, Chip } from "@heroui/react";
import { clinicOverview } from "@/data/clinic";
import { Section } from "@/sections/Section";

export function MissionSection() {
  return (
    <Section
      id="clinica"
      eyebrow="Clínica"
      title="Misión, visión y propósito"
      subtitle="Bioalergia integra medicina de precisión y atención humanizada para pacientes con alergias e inmunoterapia en Concepción."
    >
      <div className="grid gap-6 lg:grid-cols-3">
        {[
          { title: "Misión", text: clinicOverview.mission },
          { title: "Visión", text: clinicOverview.vision },
          { title: "Propósito", text: clinicOverview.purpose },
        ].map((item) => (
          <Card className="rounded-3xl" key={item.title} variant="secondary">
            <Card.Header className="gap-3">
              <Chip size="sm" variant="soft">
                {item.title}
              </Chip>
              <Card.Title className="text-xl">{item.title}</Card.Title>
            </Card.Header>
            <Card.Content className="text-sm text-[color:var(--ink-muted)]">{item.text}</Card.Content>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {clinicOverview.pillars.map((pillar) => (
          <Card className="rounded-2xl" key={pillar.title} variant="secondary">
            <Card.Header className="gap-2">
              <Card.Title className="text-lg">{pillar.title}</Card.Title>
            </Card.Header>
            <Card.Content className="text-sm text-[color:var(--ink-muted)]">{pillar.detail}</Card.Content>
          </Card>
        ))}
      </div>
    </Section>
  );
}
