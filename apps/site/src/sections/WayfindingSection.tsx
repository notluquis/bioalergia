import { Button, Link } from "@heroui/react";

import { SectionBand } from "@/components/ui/SectionBand";
import { ctaClass } from "@/components/ui/cta";
import { Eyebrow } from "@/components/ui/Eyebrow";

type Route = {
  eyebrow: string;
  title: string;
  body: string;
  cta: string;
  variant: "primary" | "secondary" | "outline";
  href?: string;
};

const routes: Route[] = [
  {
    eyebrow: "Pacientes",
    title: "Quiero atenderme",
    body: "Agenda tu hora y revisa exámenes y tratamientos, para ti o tu familia.",
    cta: "Agendar mi hora →",
    variant: "primary",
  },
  {
    eyebrow: "Empresas",
    title: "Soy una empresa",
    body: "Exámenes y prevención de alergias para tu equipo de trabajo.",
    cta: "Cotizar para mi empresa →",
    variant: "secondary",
    href: "/venta-empresas",
  },
  {
    eyebrow: "Tienda",
    title: "Quiero comprar",
    body: "Botiquín y productos seleccionados, con despacho a todo Chile.",
    cta: "Ir a la tienda →",
    variant: "outline",
    href: "/tienda",
  },
];

/** Wayfinding (handoff) — "¿Qué necesitas hoy?" — three entry-point cards. */
export function WayfindingSection({ onBook }: { onBook: () => void }) {
  return (
    <SectionBand
      tone="surface2"
      borderTop
      borderBottom
      innerClassName="py-14 sm:py-16 lg:py-[3.4rem]"
    >
      <div className="mb-7 flex items-center gap-3">
        <Eyebrow>¿Qué necesitas hoy?</Eyebrow>
        <div className="h-px flex-1 bg-line" />
        <span className="text-muted text-sm">Elige por dónde partir</span>
      </div>
      <div className="grid gap-[22px] md:grid-cols-3">
        {routes.map((route) => (
          <div
            key={route.title}
            className="flex flex-col rounded-xl border border-line bg-surface p-7"
          >
            <Eyebrow className="mb-[14px] text-[0.69rem]">{route.eyebrow}</Eyebrow>
            <h3 className="mb-2 font-display text-[1.625rem] text-foreground">{route.title}</h3>
            <p className="mb-[22px] flex-1 text-[0.9rem] leading-[1.5] text-muted">{route.body}</p>
            {route.href ? (
              <Link
                className={ctaClass(route.variant, "w-full rounded-lg py-[13px] text-[0.94rem]")}
                href={route.href}
              >
                {route.cta}
              </Link>
            ) : (
              <Button
                className={ctaClass(route.variant, "w-full rounded-lg py-[13px] text-[0.94rem]")}
                onPress={onBook}
              >
                {route.cta}
              </Button>
            )}
          </div>
        ))}
      </div>
    </SectionBand>
  );
}
