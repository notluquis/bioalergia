import { Accordion } from "@heroui/react";

import { SectionBand } from "@/components/ui/SectionBand";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { faqItems } from "@/data/faq";

const homeFaqs = faqItems.slice(0, 6);

/** FAQ (handoff) — eyebrow + heading beside an accordion (first item open). */
export function FAQSection() {
  return (
    <SectionBand id="faq" tone="bg" borderTop>
      <div className="grid gap-12 lg:grid-cols-[0.7fr_1.3fr] lg:gap-14">
        <div>
          <Eyebrow className="mb-4">Preguntas frecuentes</Eyebrow>
          <h2 className="font-display text-[2rem] leading-[1.05] text-foreground sm:text-[2.5rem]">
            Lo que más nos preguntan.
          </h2>
        </div>
        <Accordion
          className="grid w-full gap-0"
          defaultExpandedKeys={[homeFaqs[0]?.question ?? ""]}
          variant="surface"
        >
          {homeFaqs.map((item) => (
            <Accordion.Item key={item.question} className="border-line border-b py-2">
              <Accordion.Heading>
                <Accordion.Trigger className="items-baseline gap-5 py-3 text-left font-bold text-[1.1875rem] text-foreground">
                  {item.question}
                  <Accordion.Indicator className="size-5 text-brand-blue" />
                </Accordion.Trigger>
              </Accordion.Heading>
              <Accordion.Panel>
                <Accordion.Body className="max-w-[640px] pb-3 text-[0.97rem] leading-[1.6] text-muted">
                  {item.answer}
                </Accordion.Body>
              </Accordion.Panel>
            </Accordion.Item>
          ))}
        </Accordion>
      </div>
    </SectionBand>
  );
}
