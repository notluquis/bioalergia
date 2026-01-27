import { Button, Card, Link } from "@heroui/react";
import { usePostHog } from "posthog-js/react";
import { contactInfo, ctaCopy } from "@/data/clinic";
import { doctoraliaLink } from "@/lib/doctoralia";
import { Section } from "@/sections/Section";

export function ContactSection() {
  const posthog = usePostHog();
  const whatsappLink = (phone: string) => `https://wa.me/${phone.replace(/\D/g, "")}`;

  const handleEmailClick = (email: string) => {
    posthog?.capture("email_click", { email, location: "contact_section" });
    window.location.href = `mailto:${email}`;
  };

  const handleDoctoraliaClick = () => {
    posthog?.capture("doctoralia_booking_attempt", { location: "contact_section" });
    window.open(doctoraliaLink, "_blank", "noopener,noreferrer");
  };

  const handleWhatsAppClick = (phone: string) => {
    posthog?.capture("whatsapp_click", {
      location: "contact_section",
      phone,
      source: "contact_button",
    });
    window.open(whatsappLink(phone), "_blank", "noopener,noreferrer");
  };

  return (
    <Section
      id="contacto"
      eyebrow="Contacto"
      title={ctaCopy.headline}
      subtitle={ctaCopy.description}
    >
      <Card className="rounded-3xl" variant="secondary">
        <Card.Header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between md:gap-6">
          <div className="space-y-2 flex-1">
            <div className="text-xs uppercase tracking-[0.28em] text-(--ink-muted)">
              Contacto directo
            </div>
            <button
              type="button"
              className="text-xl sm:text-2xl font-semibold no-underline break-all text-left cursor-pointer hover:underline"
              onClick={() => handleEmailClick(contactInfo.email)}
            >
              {contactInfo.email}
            </button>
            <div className="flex flex-wrap gap-3 text-(--ink-muted) text-sm sm:text-base">
              {contactInfo.phones.map((phone) => (
                <Link
                  key={phone}
                  href={whatsappLink(phone)}
                  onClick={() =>
                    posthog?.capture("whatsapp_click", {
                      location: "contact_section_phone",
                      phone,
                    })
                  }
                >
                  {phone}
                </Link>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-3 w-full md:w-auto">
            <Button
              className="rounded-full bg-(--accent) px-6 text-white"
              onPress={handleDoctoraliaClick}
            >
              Agendar en Doctoralia
            </Button>
            <Button
              className="rounded-full bg-[#25D366] px-6 text-white"
              onPress={() => handleWhatsAppClick(contactInfo.phones[0])}
            >
              Contactar por WhatsApp
            </Button>
          </div>
        </Card.Header>
        <Card.Content className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <div className="text-xs uppercase tracking-[0.28em] text-(--ink-muted)">Dirección</div>
            <p className="text-sm text-(--ink-muted)">{contactInfo.address}</p>
          </div>
          <div className="space-y-1">
            <div className="text-xs uppercase tracking-[0.28em] text-(--ink-muted)">Agenda</div>
            <p className="text-sm text-(--ink-muted)">
              Reserva tu evaluación en Doctoralia y recibe confirmación inmediata.
            </p>
          </div>
        </Card.Content>
      </Card>
    </Section>
  );
}
