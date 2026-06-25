import { Link } from "@heroui/react";

import { Container } from "@/components/ui/Container";
import { contactInfo } from "@/data/clinic";

const whatsappLink = (phone: string) => `https://wa.me/${phone.replace(/\D/g, "")}`;

/**
 * Top utility bar (handoff) — surface bg, line border, 12.5px muted text.
 * Left: specialty + city. Right: hours · phone · WhatsApp. Desktop only.
 */
export function UtilityBar() {
  return (
    <div className="hidden border-line border-b bg-surface md:block">
      <Container className="flex items-center justify-between py-[9px] text-[0.78rem] text-muted">
        <span className="tracking-[0.02em]">Alergología e Inmunología · Concepción, Chile</span>
        <div className="flex items-center gap-[18px]">
          <span>Lun–Vie 09:00–18:00</span>
          <span className="text-line">·</span>
          <span>{contactInfo.phones[0]}</span>
          <Link
            className="font-semibold text-brand-blue no-underline hover:underline"
            href={whatsappLink(contactInfo.phones[0])}
            rel="noopener noreferrer"
            target="_blank"
          >
            WhatsApp
          </Link>
        </div>
      </Container>
    </div>
  );
}
