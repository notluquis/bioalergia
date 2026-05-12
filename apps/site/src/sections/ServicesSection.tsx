import { Card } from "@heroui/react";
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
      <div className="grid gap-10 lg:grid-cols-2">
        {services.map((service) => (
          <Card className="rounded-3xl" key={service.title} variant="default">
            <Card.Header className="gap-4 pb-0">
              <Card.Title className="text-xl">{service.title}</Card.Title>
              <Card.Description className="text-(--ink-muted)">
                {service.description}
              </Card.Description>
            </Card.Header>
            <Card.Content className="grid gap-4 pb-6">
              {service.points.map((point) => (
                <div className="flex items-start gap-3 text-sm leading-relaxed" key={point}>
                  <span className="mt-2 h-2 w-2 rounded-full bg-(--accent)" />
                  <span className="text-(--ink-muted)">{point}</span>
                </div>
              ))}
            </Card.Content>
          </Card>
        ))}
      </div>
    </Section>
  );
}
