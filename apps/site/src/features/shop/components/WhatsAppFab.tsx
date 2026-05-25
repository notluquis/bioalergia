import { useMatchRoute } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";

import { contactInfo } from "@/data/clinic";

const PHONE = contactInfo.phones[0].replace(/\D/g, "");
const HREF = `https://wa.me/${PHONE}?text=${encodeURIComponent("Hola, tengo una consulta sobre la tienda.")}`;

export function WhatsAppFab() {
  const matchRoute = useMatchRoute();
  const onShop = Boolean(
    matchRoute({ to: "/tienda", fuzzy: true }) ||
    matchRoute({ to: "/producto/$slug" }) ||
    matchRoute({ to: "/carrito" }) ||
    matchRoute({ to: "/checkout" })
  );
  if (!onShop) return null;

  return (
    <a
      aria-label="Consultar por WhatsApp"
      className="fixed bottom-4 left-4 z-50 flex items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition hover:scale-105 sm:bottom-6 sm:left-6 sm:h-14 sm:w-14 size-12"
      href={HREF}
      rel="noopener noreferrer"
      target="_blank"
    >
      <MessageCircle size={22} />
    </a>
  );
}
