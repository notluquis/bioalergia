import { Button } from "@heroui/react";

import { Container } from "@/components/ui/Container";
import { ctaClass } from "@/components/ui/cta";

/** Closing CTA (handoff) — deep-blue anchor band with the final booking call. */
export function ClosingCtaSection({
  onBook,
  onWhatsApp,
}: {
  onBook: () => void;
  onWhatsApp: () => void;
}) {
  return (
    <section className="bg-brand-blue-deep text-[#eef3f9]">
      <Container className="flex flex-col items-start justify-between gap-10 py-[5.5rem] lg:flex-row lg:items-center">
        <h2 className="max-w-[660px] font-display text-[2rem] leading-[1.05] text-[#f7f9fc] sm:text-[2.5rem]">
          Recupera el control de tus alergias. Empieza con una evaluación.
        </h2>
        <div className="flex w-full min-w-[240px] flex-col gap-3.5 lg:w-auto">
          <Button className={ctaClass("primary", "px-[30px] py-4 text-base")} onPress={onBook}>
            Reservar evaluación
          </Button>
          <Button
            className="inline-flex items-center justify-center gap-2 rounded-[3px] border border-[#3f5f86] px-[30px] py-[15px] font-semibold text-[#eef3f9] text-[0.94rem] transition-colors hover:bg-white/5"
            onPress={onWhatsApp}
            variant="outline"
          >
            Hablar por WhatsApp
          </Button>
        </div>
      </Container>
    </section>
  );
}
