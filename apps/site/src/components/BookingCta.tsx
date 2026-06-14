import { Button, Card } from "@heroui/react";
import { usePostHog } from "posthog-js/react";

import { contactInfo } from "@/data/clinic";
import { doctoraliaLink } from "@/lib/doctoralia";

const whatsappLink = (phone: string) => `https://wa.me/${phone.replace(/\D/g, "")}`;

/** Reusable conversion card for content pages. */
export function BookingCta({
  title = "¿Tienes dudas sobre tu caso?",
  description = "Agenda una evaluación con nuestro equipo y define el estudio o tratamiento adecuado para ti.",
  location = "content_page",
}: {
  title?: string;
  description?: string;
  location?: string;
}) {
  const posthog = usePostHog();

  const handleDoctoralia = () => {
    posthog?.capture("doctoralia_booking_attempt", { location });
    window.open(doctoraliaLink, "_blank", "noopener,noreferrer");
  };

  const handleWhatsApp = () => {
    posthog?.capture("whatsapp_click", { location });
    window.open(whatsappLink(contactInfo.phones[0]), "_blank", "noopener,noreferrer");
  };

  return (
    <Card className="rounded-3xl" variant="secondary">
      <Card.Header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between md:gap-6">
        <div className="flex-1 space-y-2">
          <Card.Title className="text-xl">{title}</Card.Title>
          <Card.Description className="text-(--ink-muted)">{description}</Card.Description>
        </div>
        <div className="flex w-full flex-col gap-3 md:w-auto">
          <Button className="rounded-full bg-(--accent) px-6 text-white" onPress={handleDoctoralia}>
            Agendar en Doctoralia
          </Button>
          <Button
            className="rounded-full bg-[#25D366] px-6 text-white"
            onPress={handleWhatsApp}
          >
            Escríbenos por WhatsApp
          </Button>
        </div>
      </Card.Header>
    </Card>
  );
}
