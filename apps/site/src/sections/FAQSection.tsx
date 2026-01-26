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
      <Card className="rounded-3xl" variant="default">
        <Card.Content className="px-6 py-6">
          <Accordion className="grid w-full gap-3" variant="surface" allowsMultipleExpanded>
            {faqItems.map((item) => (
              <Accordion.Item
                key={item.question}
                className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-2)] px-5 py-3"
              >
                <Accordion.Heading>
                  <Accordion.Trigger className="items-center text-left text-base font-medium sm:text-lg">
                    {item.question}
                    <Accordion.Indicator className="size-5 text-[color:var(--ink-muted)]" />
                  </Accordion.Trigger>
                </Accordion.Heading>
                <Accordion.Panel>
                  <Accordion.Body className="pt-2 text-sm leading-relaxed text-[color:var(--ink-muted)]">
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
