import { Card, ScrollShadow } from "@heroui/react";
import { glossary } from "@/data/glossary";
import { Section } from "@/sections/Section";

export function GlossarySection() {
  return (
    <Section
      id="glosario"
      eyebrow="Glosario"
      title="Términos clave"
      subtitle="Definiciones simples para comprender mejor tu diagnóstico y tratamiento."
    >
      <Card className="overflow-hidden rounded-3xl" variant="secondary">
        <Card.Content className="p-0">
          <ScrollShadow className="max-h-70 space-y-4 p-6 sm:max-h-90 lg:max-h-100" hideScrollBar>
            {glossary.map((item) => (
              <div className="grid gap-1" key={item.term}>
                <div className="font-semibold text-(--ink) text-sm">{item.term}</div>
                <div className="text-(--ink-muted) text-sm">{item.definition}</div>
              </div>
            ))}
          </ScrollShadow>
        </Card.Content>
      </Card>
    </Section>
  );
}
