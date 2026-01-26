import { useEffect, useMemo, useState } from "react";
import { Button, Chip, Link, Separator } from "@heroui/react";

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
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-16 px-6 py-16">
        <header className="flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <img
              src="/logo_sin_eslogan.png"
              alt="Bioalergia"
              className="h-12 w-auto sm:h-14 lg:h-16"
              loading="eager"
            />
          </div>
          <nav aria-label="Navegación principal" className="flex flex-wrap items-center gap-4 text-sm">
            <Link className="no-underline" href="#servicios">
              Servicios
            </Link>
            <Link className="no-underline" href="#inmunoterapia">
              Inmunoterapia
            </Link>
            <Link className="no-underline" href="#faq">
              FAQ
            </Link>
            <Link className="no-underline" href="#contacto">
              Contacto
            </Link>
          </nav>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Chip size="sm" variant="soft">
              Agenda online
            </Chip>
            <Button className="rounded-full bg-[var(--accent)] text-white" onPress={handleDoctoraliaOpen}>
              Agendar cita
            </Button>
            <Button
              className="rounded-full border-[color:var(--border)] text-[color:var(--ink)]"
              variant="outline"
              onPress={toggle}
            >
              {theme === "dark" ? "Modo claro" : "Modo oscuro"}
            </Button>
          </div>
        </header>

        <main className="grid gap-14">
          <HeroSection onBook={handleDoctoraliaOpen} />

          <Separator />

          <MissionSection />
          <FounderSection />
          <ServicesSection />
          <ImmunotherapySection />

          <section className="grid gap-6 lg:grid-cols-[0.6fr_1fr]">
            <DoctoraliaCertificate />
            <LocationSection />
          </section>

          <FAQSection />
          <GlossarySection />
          <ContactSection />
        </main>
      </div>
    </div>
  );
}
