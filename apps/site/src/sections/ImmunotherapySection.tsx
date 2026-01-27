import { Card } from "@heroui/react";
import { immunotherapyBenefits, immunotherapyComparison } from "@/data/services";
import { Section } from "@/sections/Section";

const abbreviations = [
  {
    label: "SCIT",
    detail: "Inmunoterapia subcutánea: inyecciones controladas en clínica.",
  },
  {
    label: "SLIT",
    detail: "Inmunoterapia sublingual: gotas o tabletas en casa con seguimiento.",
  },
];

export function ImmunotherapySection() {
  return (
    <Section
      id="inmunoterapia"
      eyebrow="Inmunoterapia"
      title="SCIT vs SLIT"
      subtitle="Elegimos la modalidad adecuada según diagnóstico, estilo de vida y seguridad clínica."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        {abbreviations.map((item) => (
          <Card className="rounded-2xl" key={item.label} variant="default">
            <Card.Header className="gap-3 pb-5">
              <Card.Title className="text-lg">{item.label}</Card.Title>
              <Card.Description className="text-(--ink-muted)">{item.detail}</Card.Description>
            </Card.Header>
          </Card>
        ))}
      </div>

      <Card className="rounded-3xl" variant="default">
        <Card.Header className="gap-2">
          <Card.Title className="text-xl">Comparativa clínica</Card.Title>
          <Card.Description className="text-(--ink-muted)">
            Diferencias clave para tomar una decisión informada.
          </Card.Description>
        </Card.Header>
        <Card.Content className="overflow-x-auto pb-6 sm:overflow-x-visible">
          <div className="space-y-0">
            {/* Header Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 border-b border-border pb-3 sm:pb-4">
              <div className="text-xs uppercase tracking-[0.2em] text-(--ink-muted) font-semibold">
                Aspecto
              </div>
              <div className="text-xs uppercase tracking-[0.2em] text-(--ink-muted) font-semibold">
                SCIT · subcutánea
              </div>
              <div className="text-xs uppercase tracking-[0.2em] text-(--ink-muted) font-semibold">
                SLIT · sublingual
              </div>
            </div>

            {/* Data Rows with zebra striping */}
            {immunotherapyComparison.map((row, index) => (
              <div
                key={row.aspect}
                className={`grid grid-cols-1 sm:grid-cols-3 gap-6 border-b border-border py-4 px-4 -mx-4 ${
                  index % 2 === 0 ? "bg-(--surface-2)" : ""
                }`}
              >
                <div className="text-(--ink) font-semibold text-sm sm:text-base">{row.aspect}</div>
                <div className="text-sm text-(--ink-muted)">{row.scit}</div>
                <div className="text-sm text-(--ink-muted)">{row.slit}</div>
              </div>
            ))}
          </div>
        </Card.Content>
      </Card>

      <Card className="rounded-3xl" variant="secondary">
        <Card.Header className="gap-3">
          <Card.Title className="text-xl">Beneficios de la inmunoterapia</Card.Title>
          <Card.Description className="text-(--ink-muted)">
            Tratamiento modificador de la enfermedad, con impacto sostenido en el tiempo.
          </Card.Description>
        </Card.Header>
        <Card.Content className="grid gap-4 pb-6">
          {immunotherapyBenefits.map((benefit) => (
            <div className="flex items-start gap-3 text-sm leading-relaxed" key={benefit}>
              <span className="mt-2 h-2 w-2 rounded-full bg-(--accent)" />
              <span className="text-(--ink-muted)">{benefit}</span>
            </div>
          ))}
        </Card.Content>
      </Card>
    </Section>
  );
}
