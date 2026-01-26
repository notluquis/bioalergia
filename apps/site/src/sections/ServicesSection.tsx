import { Card, Chip } from "@heroui/react";
import { services } from "@/data/services";
import { Section } from "@/sections/Section";

export function ServicesSection() {
  return (
    <Section
      id="servicios"
      eyebrow="Servicios"
      title="Qué hacemos"
      subtitle="Evaluación clínica integral, diagnóstico de precisión e inmunoterapia personalizada."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        {services.map((service) => (
          <Card className="rounded-3xl" key={service.title} variant="secondary">
            <Card.Header className="gap-3">
              <Card.Title className="text-xl">{service.title}</Card.Title>
              <Card.Description className="text-[color:var(--ink-muted)]">
                {service.description}
              </Card.Description>
            </Card.Header>
            <Card.Content className="grid gap-2">
              {service.points.map((point) => (
                <div className="flex items-start gap-2 text-sm" key={point}>
                  <Chip size="sm" variant="soft">
                    ✓
                  </Chip>
                  <span className="text-[color:var(--ink-muted)]">{point}</span>
                </div>
              ))}
            </Card.Content>
          </Card>
        ))}
      </div>
    </Section>
  );
}
