import { Accordion } from "@heroui/react";
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
      <Accordion className="w-full" variant="surface" allowsMultipleExpanded>
        {faqItems.map((item) => (
          <Accordion.Item key={item.question}>
            <Accordion.Heading>
              <Accordion.Trigger className="text-left">
                {item.question}
                <Accordion.Indicator />
              </Accordion.Trigger>
            </Accordion.Heading>
            <Accordion.Panel>
              <Accordion.Body className="text-[color:var(--ink-muted)]">
                {item.answer}
              </Accordion.Body>
            </Accordion.Panel>
          </Accordion.Item>
        ))}
      </Accordion>
    </Section>
  );
}
