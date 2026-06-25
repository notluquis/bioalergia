import { Button } from "@heroui/react";
import { lazy, Suspense } from "react";

import { Container } from "@/components/ui/Container";
import { ctaClass } from "@/components/ui/cta";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { MoleculeMotif } from "@/components/ui/MoleculeMotif";

const DoctoraliaBookingWidget = lazy(() =>
  import("@/sections/DoctoraliaWidgets").then((m) => ({ default: m.DoctoraliaBookingWidget }))
);

const PollenHeroCard = lazy(() =>
  import("@/sections/PollenHeroCard").then((m) => ({ default: m.PollenHeroCard }))
);

type HeroSectionProps = {
  onBook: () => void;
  onWhatsApp: () => void;
};

/**
 * Hero (handoff) — editorial split: brand copy + CTAs on the left with the live
 * pollen indicator filling the column foot, the real Doctoralia booking widget
 * (full height) on the right, molecular motif behind. `items-stretch` lets the
 * left column match the tall widget so the pollen card sits at its base.
 */
export function HeroSection({ onBook, onWhatsApp }: HeroSectionProps) {
  return (
    <section className="relative overflow-hidden bg-background" id="inicio">
      <MoleculeMotif className="pointer-events-none absolute top-[-40px] right-[-30px] size-[440px] text-[#c9d8ea] opacity-30" />
      <Container className="relative grid items-start gap-10 pt-6 pb-16 lg:grid-cols-[1fr_1.02fr] lg:gap-14 lg:pt-8 lg:pb-[5.25rem]">
        <div className="flex flex-col">
          <Eyebrow className="mb-6">Clínica especializada en respiración</Eyebrow>
          <h1 className="font-display text-[2.75rem] leading-[1.06] text-foreground sm:text-[3.5rem] lg:text-[4.125rem]">
            Vuelve a respirar sin que las alergias decidan por ti.
          </h1>
          <p className="mt-5 max-w-[460px] text-[1.125rem] leading-[1.6] text-muted">
            Estudiamos tu alergia, te explicamos en simple qué tienes y armamos un tratamiento a tu
            medida. Atención para adultos, adolescentes y niños en Concepción.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-[18px]">
            <Button
              className={ctaClass("primary", "px-[30px] py-[15px] text-[0.97rem]")}
              onPress={onBook}
            >
              Reservar evaluación
            </Button>
            <Button
              className={ctaClass("whatsapp", "h-auto bg-transparent px-0")}
              onPress={onWhatsApp}
              variant="tertiary"
            >
              <span className="size-[9px] rounded-full bg-doctoralia-green" />
              Hablar por WhatsApp
            </Button>
          </div>
          <div className="mt-10 flex flex-wrap items-center gap-[14px] border-line border-t pt-[26px] text-[0.84rem] text-muted">
            <span className="font-semibold text-foreground">Dr. José Manuel Martínez</span>
            <span className="text-line">·</span>
            <span>Formación AAAeIC Argentina y pasantía en España</span>
          </div>
          <Suspense fallback={null}>
            <div className="mt-8">
              <PollenHeroCard />
            </div>
          </Suspense>
        </div>
        <Suspense
          fallback={<div className="min-h-[25rem] animate-pulse rounded-2xl bg-surface-2" />}
        >
          <DoctoraliaBookingWidget />
        </Suspense>
      </Container>
    </section>
  );
}
