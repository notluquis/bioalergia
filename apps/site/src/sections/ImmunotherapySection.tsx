import { Card, Chip } from "@heroui/react";
import { immunotherapyBenefits, immunotherapyComparison } from "@/data/services";
import { Section } from "@/sections/Section";

export function ImmunotherapySection() {
  return (
    <Section
      id="inmunoterapia"
      eyebrow="Inmunoterapia"
      title="SCIT vs SLIT"
      subtitle="Elegimos la modalidad adecuada según diagnóstico, estilo de vida y seguridad clínica."
    >
      <div className="grid gap-4">
        {immunotherapyComparison.map((row) => (
          <Card className="rounded-2xl" key={row.aspect} variant="secondary">
            <Card.Header className="gap-2">
              <Chip size="sm" variant="soft">
                {row.aspect}
              </Chip>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <div className="text-xs uppercase tracking-wide text-[color:var(--ink-muted)]">SCIT</div>
                  <p className="text-sm text-[color:var(--ink-muted)]">{row.scit}</p>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-[color:var(--ink-muted)]">SLIT</div>
                  <p className="text-sm text-[color:var(--ink-muted)]">{row.slit}</p>
                </div>
              </div>
            </Card.Header>
          </Card>
        ))}
      </div>

      <Card className="rounded-3xl" variant="secondary">
        <Card.Header className="gap-3">
          <Card.Title className="text-xl">Beneficios de la inmunoterapia</Card.Title>
          <Card.Description className="text-[color:var(--ink-muted)]">
            Tratamiento modificador de la enfermedad, con impacto sostenido en el tiempo.
          </Card.Description>
        </Card.Header>
        <Card.Content className="grid gap-2">
          {immunotherapyBenefits.map((benefit) => (
            <div className="flex items-start gap-2 text-sm" key={benefit}>
              <Chip size="sm" variant="soft">
                ✓
              </Chip>
              <span className="text-[color:var(--ink-muted)]">{benefit}</span>
            </div>
          ))}
        </Card.Content>
      </Card>
    </Section>
  );
}
