import { Button, Card, Chip, Link } from "@heroui/react";
import { clinicOverview } from "@/data/clinic";
import { DoctoraliaBookingWidget, doctoraliaLink } from "@/sections/DoctoraliaWidgets";

const badges = ["Alergología", "Inmunología", "Adultos y niños", "Concepción, Chile"];

type HeroSectionProps = {
  onBook: () => void;
};

export function HeroSection({ onBook }: HeroSectionProps) {
  return (
    <section className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr]" id="inicio">
      <div className="flex flex-col gap-6" style={{ animation: "floatIn 0.8s ease-out" }}>
        <div className="flex flex-wrap gap-2">
          {badges.map((badge) => (
            <Chip key={badge} size="sm" variant="soft">
              {badge}
            </Chip>
          ))}
        </div>
        <div className="space-y-4">
          <p className="text-xs uppercase tracking-[0.28em] text-(--ink-muted)">
            {clinicOverview.subtitle}
          </p>
          <h1 className="text-4xl font-semibold leading-tight text-(--ink) sm:text-5xl lg:text-6xl">
            Clínica Bioalergia
            <span
              className="mt-3 block text-3xl font-normal text-(--ink-muted) sm:text-4xl"
              style={{ fontFamily: '"Instrument Serif", serif' }}
            >
              Especialistas en alergias e inmunoterapia
            </span>
          </h1>
          <p className="max-w-xl text-lg text-(--ink-muted)">
            Diagnóstico preciso, tratamientos personalizados y acompañamiento clínico para mejorar tu
            calidad de vida.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button className="rounded-full bg-(--accent) px-6 text-white" onPress={onBook}>
            Reservar evaluación
          </Button>
          <Link
            className="text-sm text-(--ink-muted) underline-offset-4"
            href="#servicios"
          >
            Ver servicios
          </Link>
          <Link
            className="text-sm text-(--ink-muted) underline-offset-4"
            href={doctoraliaLink}
            target="_blank"
            rel="noreferrer"
          >
            Agenda online
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {clinicOverview.summary.map((item) => (
            <Card className="rounded-2xl" key={item} variant="secondary">
              <Card.Content className="text-sm text-(--ink-muted)">{item}</Card.Content>
            </Card>
          ))}
        </div>
      </div>
      <div className="lg:pl-4" style={{ animation: "floatIn 0.9s ease-out" }}>
        <DoctoraliaBookingWidget />
      </div>
    </section>
  );
}
