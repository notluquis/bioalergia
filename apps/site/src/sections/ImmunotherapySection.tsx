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
              <Card.Description className="text-(--ink-muted)">
                {item.detail}
              </Card.Description>
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
        <Card.Content className="overflow-x-auto pb-6">
          <div className="min-w-[560px]">
            <div className="grid grid-cols-[160px_1fr_1fr] gap-6 border-b border-(--border) pb-3 text-xs uppercase tracking-[0.2em] text-(--ink-muted)">
              <span>Aspecto</span>
              <span>SCIT · subcutánea</span>
              <span>SLIT · sublingual</span>
            </div>
            <div className="grid gap-4 pt-4">
              {immunotherapyComparison.map((row) => (
                <div
                  className="grid grid-cols-[160px_1fr_1fr] gap-6 border-b border-(--border) pb-4 text-sm text-(--ink-muted) last:border-b-0"
                  key={row.aspect}
                >
                  <span className="text-(--ink)">{row.aspect}</span>
                  <span>{row.scit}</span>
                  <span>{row.slit}</span>
                </div>
              ))}
            </div>
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
