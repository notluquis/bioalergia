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
      <Card className="rounded-3xl" variant="secondary">
        <Card.Content className="p-0">
          <ScrollShadow className="max-h-[360px] space-y-4 p-6" hideScrollBar>
            {glossary.map((item) => (
              <div className="grid gap-1" key={item.term}>
                <div className="text-sm font-semibold text-[color:var(--ink)]">{item.term}</div>
                <div className="text-sm text-[color:var(--ink-muted)]">{item.definition}</div>
              </div>
            ))}
          </ScrollShadow>
        </Card.Content>
      </Card>
    </Section>
  );
}
