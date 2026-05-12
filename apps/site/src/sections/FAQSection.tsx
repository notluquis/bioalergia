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
          <Accordion
            className="grid w-full gap-3"
            variant="surface"
            allowsMultipleExpanded
            defaultExpandedKeys={[faqItems[0]?.question || ""]}
          >
            {faqItems.map((item) => (
              <Accordion.Item
                key={item.question}
                className="rounded-2xl border border-border bg-(--surface-2) px-5 py-3"
              >
                <Accordion.Heading>
                  <Accordion.Trigger className="items-center text-left font-medium text-base sm:text-lg">
                    {item.question}
                    <Accordion.Indicator className="size-5 text-(--ink-muted)" />
                  </Accordion.Trigger>
                </Accordion.Heading>
                <Accordion.Panel>
                  <Accordion.Body className="pt-2 text-(--ink-muted) text-sm leading-relaxed sm:text-base">
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
