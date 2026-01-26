import { Card, ScrollShadow } from "@heroui/react";
import { founderProfile } from "@/data/founder";
import { Section } from "@/sections/Section";

export function FounderSection() {
  return (
    <Section
      id="fundador"
      eyebrow="Fundador"
      title={founderProfile.name}
      subtitle="Trayectoria clínica internacional y enfoque centrado en el paciente alérgico."
    >
      <Card className="rounded-3xl" variant="secondary">
        <Card.Content className="p-0">
          <ScrollShadow className="max-h-[360px] space-y-4 p-6" hideScrollBar>
            {founderProfile.paragraphs.map((paragraph) => (
              <p className="text-sm leading-6 text-[color:var(--ink-muted)]" key={paragraph}>
                {paragraph}
              </p>
            ))}
          </ScrollShadow>
        </Card.Content>
      </Card>
    </Section>
  );
}
