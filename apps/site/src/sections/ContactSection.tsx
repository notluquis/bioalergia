import { Button, Card, Link } from "@heroui/react";
import { contactInfo, ctaCopy } from "@/data/clinic";
import { Section } from "@/sections/Section";
import { doctoraliaLink } from "@/sections/DoctoraliaWidgets";

export function ContactSection() {
  return (
    <Section id="contacto" eyebrow="Contacto" title={ctaCopy.headline} subtitle={ctaCopy.description}>
      <Card className="rounded-3xl" variant="secondary">
        <Card.Header className="flex flex-wrap items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-[0.28em] text-[color:var(--ink-muted)]">
              Contacto directo
            </div>
            <Link href={`mailto:${contactInfo.email}`} className="text-2xl font-semibold no-underline">
              {contactInfo.email}
            </Link>
            <div className="flex flex-wrap gap-3 text-[color:var(--ink-muted)]">
              {contactInfo.phones.map((phone) => (
                <Link key={phone} href={`tel:${phone.replace(/\s/g, "")}`}>
                  {phone}
                </Link>
              ))}
            </div>
          </div>
          <Button
            className="rounded-full bg-[var(--accent-2)] px-6 text-white"
            onPress={() => window.open(doctoraliaLink, "_blank", "noopener,noreferrer")}
          >
            Hablar con el equipo
          </Button>
        </Card.Header>
        <Card.Content className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <div className="text-xs uppercase tracking-[0.28em] text-[color:var(--ink-muted)]">Dirección</div>
            <p className="text-sm text-[color:var(--ink-muted)]">{contactInfo.address}</p>
          </div>
          <div className="space-y-1">
            <div className="text-xs uppercase tracking-[0.28em] text-[color:var(--ink-muted)]">Agenda</div>
            <p className="text-sm text-[color:var(--ink-muted)]">
              Reserva tu evaluación en Doctoralia y recibe confirmación inmediata.
            </p>
          </div>
        </Card.Content>
      </Card>
    </Section>
  );
}
