import { Lock, RotateCcw, ShieldCheck, Stethoscope } from "lucide-react";

// Trust block legal Chile + visual confianza. Aparece en /carrito,
// /checkout y opcional bajo el grid en /tienda. Cubre:
//   - Derecho de retracto 10 días (Ley 19.496 art. 3 bis)
//   - Garantía legal 6 meses (Ley Pro-Consumidor)
//   - Pago seguro (MercadoPago + Webpay vía MP)
//   - ISP placeholder cuando se vendan medicamentos OTC
//
// Texto plano corto para evitar muro. Link a /legal/* para detalle.

export function TrustBlock({ compact = false }: { compact?: boolean }) {
  const items = [
    {
      icon: <RotateCcw size={18} />,
      title: "Retracto 10 días",
      body: "Devolución gratuita dentro de 10 días corridos desde la entrega (Ley 19.496).",
      href: "/legal/retracto",
    },
    {
      icon: <ShieldCheck size={18} />,
      title: "Garantía legal 6 meses",
      body: "Cambio, reparación o reembolso según la Ley Pro Consumidor.",
      href: "/legal/garantia",
    },
    {
      icon: <Lock size={18} />,
      title: "Pago seguro MercadoPago",
      body: "Webpay, tarjeta o billetera digital. No almacenamos datos de tarjeta.",
      href: "/legal/pagos",
    },
    {
      icon: <Stethoscope size={18} />,
      title: "Comercio supervisado",
      body: "Productos dermocosméticos. Para medicamentos OTC se exige receta o consulta clínica.",
      href: "/legal/isp",
    },
  ];

  return (
    <section
      className={
        compact
          ? "grid grid-cols-2 gap-2 text-xs sm:grid-cols-4 sm:text-sm"
          : "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
      }
    >
      {items.map((i) => (
        <a
          className="flex gap-3 rounded-xl border border-foreground/10 bg-foreground/[0.02] p-3 no-underline hover:bg-foreground/5"
          href={i.href}
          key={i.title}
        >
          <span className="text-(--accent)">{i.icon}</span>
          <span>
            <strong className="block">{i.title}</strong>
            <span className={compact ? "hidden" : "text-foreground/70 text-xs"}>{i.body}</span>
          </span>
        </a>
      ))}
    </section>
  );
}
