import { Button, Card, Link } from "@heroui/react";
import { contactInfo, ctaCopy } from "@/data/clinic";
import { Section } from "@/sections/Section";
import { doctoraliaLink } from "@/sections/DoctoraliaWidgets";

export function ContactSection() {
  return (
    <Section id="contacto" eyebrow="Contacto" title={ctaCopy.headline} subtitle={ctaCopy.description}>
      <Card className="rounded-3xl" variant="secondary">
        <Card.Header className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-wide text-[color:var(--ink-muted)]">
              Contacto directo
            </div>
            <Link href={`mailto:${contactInfo.email}`} className="text-2xl font-semibold no-underline">
              {contactInfo.email}
            </Link>
            <Link href={`tel:${contactInfo.phone.replace(/\s/g, "")}`} className="text-[color:var(--ink-muted)]">
              {contactInfo.phone}
            </Link>
          </div>
          <Button
            className="rounded-full bg-[var(--accent-2)] text-white"
            onPress={() => window.open(doctoraliaLink, "_blank", "noopener,noreferrer")}
          >
            Hablar con el equipo
          </Button>
        </Card.Header>
      </Card>
    </Section>
  );
}
