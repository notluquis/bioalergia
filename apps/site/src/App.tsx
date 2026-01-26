import { useEffect, useMemo, useState } from "react";
import { Button, Link, Separator } from "@heroui/react";

import { contactInfo } from "@/data/clinic";
import { ContactSection } from "@/sections/ContactSection";
import { DoctoraliaCertificate } from "@/sections/DoctoraliaWidgets";
import { FAQSection } from "@/sections/FAQSection";
import { FounderSection } from "@/sections/FounderSection";
import { GlossarySection } from "@/sections/GlossarySection";
import { HeroSection } from "@/sections/HeroSection";
import { ImmunotherapySection } from "@/sections/ImmunotherapySection";
import { LocationSection } from "@/sections/LocationSection";
import { MissionSection } from "@/sections/MissionSection";
import { ServicesSection } from "@/sections/ServicesSection";
import { doctoraliaLink } from "@/sections/DoctoraliaWidgets";

function useThemePreference() {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "light";
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (event: MediaQueryListEvent) => {
      setTheme(event.matches ? "dark" : "light");
    };
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return useMemo(
    () => ({
      theme,
      toggle: () => setTheme((current) => (current === "dark" ? "light" : "dark")),
    }),
    [theme],
  );
}

export default function App() {
  const { theme, toggle } = useThemePreference();
  const handleDoctoraliaOpen = () => {
    window.open(doctoraliaLink, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="relative overflow-hidden">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-12 px-6 py-12 lg:gap-16 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-full border border-[color:var(--border)] bg-[color:var(--surface-2)] px-5 py-2 text-xs text-[color:var(--ink-muted)]">
          <span>Bienvenidos a Bioalergia · Atención especializada en Concepción</span>
          <div className="flex flex-wrap items-center gap-4">
            <Link className="no-underline" href={`tel:${contactInfo.phone.replace(/\s/g, "")}`}>
              {contactInfo.phone}
            </Link>
            <Link className="no-underline" href={`mailto:${contactInfo.email}`}>
              {contactInfo.email}
            </Link>
          </div>
        </div>

        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img
              src="/logo_sin_eslogan.png"
              alt="Bioalergia"
              className="h-12 w-auto sm:h-14 lg:h-16"
              loading="eager"
            />
          </div>
          <nav
            aria-label="Navegación principal"
            className="flex flex-wrap items-center gap-4 text-sm text-[color:var(--ink-muted)]"
          >
            <Link className="no-underline transition-colors hover:text-[color:var(--ink)]" href="#inicio">
              Inicio
            </Link>
            <Link className="no-underline transition-colors hover:text-[color:var(--ink)]" href="#servicios">
              Servicios
            </Link>
            <Link
              className="no-underline transition-colors hover:text-[color:var(--ink)]"
              href="#inmunoterapia"
            >
              Inmunoterapia
            </Link>
            <Link className="no-underline transition-colors hover:text-[color:var(--ink)]" href="#faq">
              FAQ
            </Link>
            <Link
              className="no-underline transition-colors hover:text-[color:var(--ink)]"
              href="#contacto"
            >
              Contacto
            </Link>
          </nav>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Button className="h-9 rounded-full bg-[var(--accent)] px-4 text-white" onPress={handleDoctoraliaOpen}>
              Agendar cita
            </Button>
            <Button
              className="h-9 rounded-full border-[color:var(--border)] px-4 text-[color:var(--ink-muted)]"
              variant="outline"
              onPress={toggle}
            >
              {theme === "dark" ? "Modo claro" : "Modo oscuro"}
            </Button>
          </div>
        </header>

        <main className="grid gap-20">
          <HeroSection onBook={handleDoctoraliaOpen} />

          <Separator className="opacity-60" />

          <MissionSection />
          <FounderSection />
          <ServicesSection />
          <ImmunotherapySection />

          <section className="grid gap-6 lg:grid-cols-[0.55fr_1fr] lg:items-stretch">
            <DoctoraliaCertificate />
            <LocationSection />
          </section>

          <Separator className="opacity-60" />

          <FAQSection />
          <GlossarySection />

          <Separator className="opacity-60" />

          <ContactSection />
        </main>
      </div>
    </div>
  );
}
