import { Container } from "@/components/ui/Container";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Photo } from "@/components/ui/Photo";
import { founderProfile } from "@/data/founder";

const credentials = ["U. de Concepción", "U. de Chile", "AAAeIC Argentina", "Pasantía España"];

/** Founder (handoff) — deep-blue anchor band, portrait bleed + pull quote. */
export function FounderSection() {
  return (
    <section className="bg-brand-blue-deep text-[#eef3f9]" id="fundador">
      <Container className="grid items-stretch gap-0 px-0 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="relative min-h-[360px] lg:min-h-[520px]">
          <Photo
            className="absolute inset-0 size-full"
            name="founderPortrait"
            rounded="rounded-none"
            sizes="(min-width: 1024px) 460px, 100vw"
          />
        </div>
        <div className="flex flex-col justify-center px-5 py-16 sm:px-8 lg:py-[5.75rem] lg:pr-10 lg:pl-16">
          <Eyebrow className="mb-6" tone="amber">
            El fundador
          </Eyebrow>
          <p className="mb-7 font-display text-[1.75rem] leading-[1.3] text-[#f7f9fc] sm:text-[2rem]">
            «Mi propósito es ofrecer a cada persona la mejor alternativa de estudio y tratamiento,
            transformando la historia natural de la enfermedad con intervenciones sostenidas y
            seguras.»
          </p>
          <div className="mb-1 font-bold text-[1.0625rem] text-white">{founderProfile.name}</div>
          <div className="mb-[26px] text-[#9fb4ce] text-sm">
            Fundador y director · Alergología e Inmunología clínica
          </div>
          <div className="flex flex-wrap gap-x-[18px] gap-y-[10px] border-[#eef3f9]/15 border-t pt-[22px] text-[#c3d2e4] text-[0.8125rem]">
            {credentials.map((c, i) => (
              <span key={c} className="flex items-center gap-x-[18px]">
                {i > 0 ? <span className="text-[#3f5f86]">·</span> : null}
                {c}
              </span>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
