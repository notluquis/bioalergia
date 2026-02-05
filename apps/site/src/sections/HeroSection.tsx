import { Button, Card, Chip, Link } from "@heroui/react";
import { usePostHog } from "posthog-js/react";
import { lazy, Suspense } from "react";
import { clinicOverview } from "@/data/clinic";
import { doctoraliaLink } from "@/lib/doctoralia";

const DoctoraliaBookingWidget = lazy(() =>
  import("@/sections/DoctoraliaWidgets").then((m) => ({
    default: m.DoctoraliaBookingWidget,
  })),
);

const badges = ["Alergología", "Inmunología", "Adultos y niños", "Concepción, Chile"];

type HeroSectionProps = {
  onBook: () => void;
};

export function HeroSection({ onBook }: HeroSectionProps) {
  const posthog = usePostHog();

  const handleDoctoraliaLink = () => {
    posthog?.capture("doctoralia_link_click", { location: "hero_section" });
  };
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
          <p className="text-(--ink-muted) text-xs uppercase tracking-[0.28em]">
            {clinicOverview.subtitle}
          </p>
          <h1 className="font-semibold text-(--ink) text-3xl leading-tight sm:text-4xl md:text-5xl lg:text-6xl">
            Clínica Bioalergia
            <span
              className="mt-2 block font-normal text-(--ink-muted) text-2xl sm:text-3xl md:text-4xl"
              style={{ fontFamily: '"Instrument Serif", serif' }}
            >
              Especialistas en alergias e inmunoterapia
            </span>
          </h1>
          <p className="max-w-xl text-(--ink-muted) text-base sm:text-lg">
            Diagnóstico preciso, tratamientos personalizados y acompañamiento clínico para mejorar
            tu calidad de vida.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button className="rounded-full bg-(--accent) px-6 text-white" onPress={onBook}>
            Reservar evaluación
          </Button>
          <Link className="text-(--ink-muted) text-sm underline-offset-4" href="#servicios">
            Ver servicios
          </Link>
          <Link
            className="text-(--ink-muted) text-sm underline-offset-4"
            href={doctoraliaLink}
            target="_blank"
            rel="noreferrer"
            onClick={handleDoctoraliaLink}
          >
            Agenda online
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {clinicOverview.summary.map((item) => (
            <Card className="rounded-2xl" key={item} variant="secondary">
              <Card.Content className="text-(--ink-muted) text-sm">{item}</Card.Content>
            </Card>
          ))}
        </div>
      </div>
      <div className="lg:pl-4" style={{ animation: "floatIn 0.9s ease-out" }}>
        <Suspense fallback={<div className="h-96 animate-pulse rounded-lg bg-gray-200" />}>
          <DoctoraliaBookingWidget />
        </Suspense>
      </div>
    </section>
  );
}
