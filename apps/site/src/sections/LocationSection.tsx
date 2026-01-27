import { Button, Card } from "@heroui/react";
import { contactInfo } from "@/data/clinic";

const clinicMapQuery = encodeURIComponent(contactInfo.address);
const clinicMapUrl = `https://www.google.com/maps/search/?api=1&query=${clinicMapQuery}`;
const clinicMapEmbedUrl = `https://www.google.com/maps?q=${clinicMapQuery}&output=embed`;

export function LocationSection() {
  return (
    <Card className="h-full rounded-3xl" variant="secondary">
      <Card.Header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-[0.28em] text-(--ink-muted)">Ubicación</div>
          <Card.Title className="text-2xl">Centro Costanera</Card.Title>
          <Card.Description className="max-w-md text-(--ink-muted)">
            {contactInfo.address}
          </Card.Description>
        </div>
        <Button
          className="rounded-full bg-(--accent) text-white"
          onPress={() => window.open(clinicMapUrl, "_blank", "noopener,noreferrer")}
        >
          Cómo llegar
        </Button>
      </Card.Header>
      <Card.Content className="p-4">
        <div className="overflow-hidden rounded-2xl border border-border aspect-video sm:aspect-auto">
          <iframe
            title="Mapa Bioalergia"
            src={clinicMapEmbedUrl}
            className="h-64 w-full sm:h-72 md:h-96"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </Card.Content>
    </Card>
  );
}
