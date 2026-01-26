import { Accordion, Card } from "@heroui/react";
import { faqItems } from "@/data/faq";
import { Section } from "@/sections/Section";

export function FAQSection() {
  return (
    <Section
      id="faq"
      eyebrow="Preguntas frecuentes"
      title="Respuestas claras y directas"
      subtitle="Información clave sobre inmunoterapia, diagnóstico y seguridad clínica."
    >
      <Card className="rounded-3xl" variant="secondary">
        <Card.Content>
          <Accordion className="w-full" variant="surface" allowsMultipleExpanded>
            {faqItems.map((item) => (
              <Accordion.Item key={item.question}>
                <Accordion.Heading>
                  <Accordion.Trigger className="items-center text-left text-base">
                    {item.question}
                    <Accordion.Indicator className="text-lg text-[color:var(--ink-muted)]" />
                  </Accordion.Trigger>
                </Accordion.Heading>
                <Accordion.Panel>
                  <Accordion.Body className="text-sm text-[color:var(--ink-muted)]">
                    {item.answer}
                  </Accordion.Body>
                </Accordion.Panel>
              </Accordion.Item>
            ))}
          </Accordion>
        </Card.Content>
      </Card>
    </Section>
  );
}
