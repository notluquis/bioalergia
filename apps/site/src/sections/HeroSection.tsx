import { Button, Chip } from "@heroui/react";
import { clinicOverview } from "@/data/clinic";
import { DoctoraliaBookingWidget, doctoraliaLink } from "@/sections/DoctoraliaWidgets";

const badges = ["Alergología", "Inmunología", "Adultos y niños", "Concepción, Chile"];

type HeroSectionProps = {
  onBook: () => void;
};

export function HeroSection({ onBook }: HeroSectionProps) {
  return (
    <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]" id="inicio">
      <div className="flex flex-col gap-6" style={{ animation: "floatIn 0.8s ease-out" }}>
        <div className="flex flex-wrap gap-2">
          {badges.map((badge) => (
            <Chip key={badge} size="sm" variant="soft">
              {badge}
            </Chip>
          ))}
        </div>
        <div className="space-y-4">
          <p className="text-sm uppercase tracking-wide text-[color:var(--ink-muted)]">
            {clinicOverview.subtitle}
          </p>
          <h1 className="text-4xl font-semibold leading-tight text-[color:var(--ink)] sm:text-6xl">
            {clinicOverview.title}
            <span
              className="mt-2 block text-4xl font-normal sm:text-5xl"
              style={{ fontFamily: '"Instrument Serif", serif' }}
            >
              Especialistas en alergias e inmunoterapia
            </span>
          </h1>
          <p className="max-w-xl text-lg text-[color:var(--ink-muted)]">
            Diagnóstico preciso, tratamientos personalizados y acompañamiento clínico para mejorar tu
            calidad de vida.
          </p>
        </div>
        <div className="flex flex-wrap gap-4">
          <Button className="rounded-full bg-[var(--accent)] text-white" onPress={onBook}>
            Reservar evaluación
          </Button>
          <Button
            className="rounded-full border-[color:var(--border)] text-[color:var(--ink)]"
            variant="outline"
            onPress={() => window.open(doctoraliaLink, "_blank", "noopener,noreferrer")}
          >
            Agenda online
          </Button>
        </div>
        <div className="grid gap-3">
          {clinicOverview.summary.map((item) => (
            <div key={item} className="text-sm text-[color:var(--ink-muted)]">
              {item}
            </div>
          ))}
        </div>
      </div>
      <div style={{ animation: "floatIn 0.9s ease-out" }}>
        <DoctoraliaBookingWidget />
      </div>
    </section>
  );
}
