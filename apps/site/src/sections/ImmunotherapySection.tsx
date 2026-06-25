import type { ClinicPhotoName } from "@/data/photos";
import { SectionBand } from "@/components/ui/SectionBand";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Photo } from "@/components/ui/Photo";

type Modality = {
  eyebrow: string;
  title: string;
  body: string;
  forWhom: string;
  photo: ClinicPhotoName;
};

const modalities: Modality[] = [
  {
    eyebrow: "SCIT · Subcutánea",
    title: "Vacunas por inyección",
    body: "Fases de inducción y mantenimiento mensual bajo observación médica. Alta eficacia con evidencia histórica sólida; reduce el riesgo de progresión a asma.",
    forWhom: "rinitis persistente, asma alérgica y sensibilizaciones múltiples.",
    photo: "scitInjection",
  },
  {
    eyebrow: "SLIT · Sublingual",
    title: "Gotas o tabletas en casa",
    body: "Administración diaria sin agujas, con seguimiento clínico periódico. Eficacia comparable en rinitis alérgica y alta adherencia.",
    forWhom: "niños y pacientes con agendas exigentes que prefieren evitar inyecciones.",
    photo: "extractsCase",
  },
];

/** Immunotherapy (handoff) — editorial quote + two modality photo cards. */
export function ImmunotherapySection() {
  return (
    <SectionBand id="inmunoterapia" tone="surface2">
      <div className="mx-auto mb-12 max-w-[760px] text-center">
        <Eyebrow className="mb-5 inline-block">Inmunoterapia</Eyebrow>
        <p className="font-display text-[1.75rem] italic leading-[1.22] text-foreground sm:text-[2.1875rem]">
          «La única terapia capaz de cambiar el curso natural de la enfermedad alérgica, en lugar de
          sólo aliviar los síntomas.»
        </p>
        <p className="mx-auto mt-[18px] max-w-[600px] text-[1rem] leading-[1.6] text-muted">
          En simple: en vez de tomar remedios para siempre, entrenamos a tu cuerpo para que deje de
          reaccionar a lo que te da alergia.
        </p>
      </div>
      <div className="grid gap-[26px] md:grid-cols-2">
        {modalities.map((m) => (
          <div key={m.title} className="overflow-hidden rounded-lg bg-surface shadow-sm">
            <Photo
              className="h-[230px]"
              name={m.photo}
              rounded="rounded-none"
              sizes="(min-width: 768px) 560px, 100vw"
            />
            <div className="p-8">
              <Eyebrow className="mb-3 text-[0.72rem]">{m.eyebrow}</Eyebrow>
              <h3 className="mb-3 font-display text-[1.6875rem] text-foreground">{m.title}</h3>
              <p className="mb-4 text-[0.94rem] leading-[1.6] text-muted">{m.body}</p>
              <div className="border-line border-t pt-4 text-[0.84rem] text-foreground">
                <b className="text-brand-blue">Para</b> {m.forWhom}
              </div>
            </div>
          </div>
        ))}
      </div>
    </SectionBand>
  );
}
