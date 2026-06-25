import { MessageCircle } from "lucide-react";

import { contactInfo } from "@/data/clinic";

const PHONE = contactInfo.phones[0].replace(/\D/g, "");
const HREF = `https://wa.me/${PHONE}?text=${encodeURIComponent("Hola, tengo una consulta.")}`;

/** Botón flotante de WhatsApp — presente en todo el sitio. */
export function WhatsAppFab() {
  return (
    <a
      aria-label="Escríbenos por WhatsApp"
      className="fixed right-5 bottom-5 z-50 flex items-center justify-center rounded-full bg-[#25D366] text-white shadow-[0_18px_40px_rgba(10,20,30,0.25)] ring-2 ring-white/80 transition hover:scale-105 sm:right-7 sm:bottom-7 size-12 sm:size-14"
      href={HREF}
      rel="noopener noreferrer"
      target="_blank"
    >
      <MessageCircle size={24} />
    </a>
  );
}
