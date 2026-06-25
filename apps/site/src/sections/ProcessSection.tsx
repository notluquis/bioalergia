import { SectionBand } from "@/components/ui/SectionBand";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Photo } from "@/components/ui/Photo";

const steps = [
  {
    title: "Diagnóstico",
    body: "Pruebas cutáneas (prick test) y medición de IgE específica para identificar tus desencadenantes con exactitud.",
  },
  {
    title: "Tratamiento",
    body: "Inmunoterapia subcutánea o sublingual con extractos estandarizados, diseñada según tu perfil alérgico.",
  },
  {
    title: "Seguimiento",
    body: "Controles periódicos para asegurar adherencia y ajustar el plan, con educación preventiva para reducir tu exposición.",
  },
];

/** Process (handoff) — three numbered clinical steps beside a real photo. */
export function ProcessSection() {
  return (
    <SectionBand tone="surface" borderTop>
      <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
        <div>
          <Eyebrow className="mb-5">Cómo te acompañamos</Eyebrow>
          <h2 className="mb-9 font-display text-[2.25rem] leading-[1.05] text-foreground sm:text-[2.75rem]">
            Un proceso clínico de principio a fin.
          </h2>
          <div className="flex flex-col gap-7">
            {steps.map((step, i) => (
              <div key={step.title} className="flex gap-[22px]">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-full border border-line bg-chip font-display text-[1.3rem] text-brand-blue">
                  {i + 1}
                </div>
                <div>
                  <h3 className="mb-1.5 font-bold text-[1.25rem] text-foreground">{step.title}</h3>
                  <p className="text-[0.97rem] leading-[1.55] text-muted">{step.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <Photo
          className="h-[420px] rounded-md lg:h-[540px]"
          name="skinTest"
          rounded="rounded-md"
          sizes="(min-width: 1024px) 580px, 100vw"
        />
      </div>
    </SectionBand>
  );
}
