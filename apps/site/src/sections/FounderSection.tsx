import { Button, Card } from "@heroui/react";
import { useState } from "react";
import { founderProfile } from "@/data/founder";
import { Section } from "@/sections/Section";

export function FounderSection() {
  const [isExpanded, setIsExpanded] = useState(false);
  const visibleParagraphs = isExpanded
    ? founderProfile.paragraphs
    : founderProfile.paragraphs.slice(0, 2);

  return (
    <Section
      id="fundador"
      eyebrow="Fundador y Director Médico"
      title={founderProfile.name}
      subtitle="Trayectoria clínica internacional y enfoque centrado en el paciente alérgico."
    >
      <Card className="rounded-3xl" variant="secondary">
        <Card.Content className="space-y-4 p-6">
          <div className="space-y-4">
            {visibleParagraphs.map((paragraph) => (
              <p className="text-(--ink-muted) text-sm leading-6" key={paragraph}>
                {paragraph}
              </p>
            ))}
          </div>
          <Button
            className="w-full rounded-full border border-(--accent) bg-transparent text-(--accent) text-sm transition-colors hover:bg-(--accent) hover:text-white"
            onPress={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? "Leer menos" : "Leer más"}
          </Button>
        </Card.Content>
      </Card>
    </Section>
  );
}
