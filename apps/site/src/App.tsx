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

function ThemeIcon({ theme }: { theme: "light" | "dark" }) {
  return theme === "dark" ? (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      viewBox="0 0 24 24"
    >
      <path
        d="M12 3v2m0 14v2m9-9h-2M5 12H3m15.36-6.36-1.42 1.42M7.06 16.94l-1.42 1.42m0-11.3 1.42 1.42m9.9 9.9 1.42 1.42"
        strokeLinecap="round"
      />
      <circle cx="12" cy="12" r="4" />
    </svg>
  ) : (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      viewBox="0 0 24 24"
    >
      <path
        d="M21 14.5A8.5 8.5 0 1 1 9.5 3a7 7 0 0 0 11.5 11.5Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function App() {
  const { theme, toggle } = useThemePreference();
  const handleDoctoraliaOpen = () => {
    window.open(doctoraliaLink, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="relative overflow-hidden">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-12 px-6 pb-12 pt-12 lg:gap-16 lg:px-8">
        <header className="sticky top-4 z-50">
          <div className="rounded-3xl border border-(--border) bg-(--surface)/90 shadow-[0_20px_60px_rgba(0,0,0,0.16)] backdrop-blur">
            <div className="hidden flex-wrap items-center justify-between gap-3 border-b border-(--border) px-5 py-2 text-xs text-(--ink-muted) md:flex">
              <span>Bienvenidos a Bioalergia · Atención especializada en Concepción</span>
              <div className="flex flex-wrap items-center gap-3">
                {contactInfo.phones.map((phone) => (
                  <Link key={phone} className="no-underline" href={`tel:${phone.replace(/\s/g, "")}`}>
                    {phone}
                  </Link>
                ))}
                <Link className="no-underline" href={`mailto:${contactInfo.email}`}>
                  {contactInfo.email}
                </Link>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
              <div className="flex items-center gap-3">
                <img
                  src="/logo_sin_eslogan.png"
                  alt="Bioalergia"
                  className="h-12 w-auto sm:h-14"
                  loading="eager"
                />
              </div>
              <nav
                aria-label="Navegación principal"
                className="flex flex-wrap items-center gap-4 text-sm text-(--ink-muted)"
              >
                <Link className="no-underline transition-colors hover:text-(--ink)" href="#inicio">
                  Inicio
                </Link>
                <Link className="no-underline transition-colors hover:text-(--ink)" href="#servicios">
                  Servicios
                </Link>
                <Link
                  className="no-underline transition-colors hover:text-(--ink)"
                  href="#inmunoterapia"
                >
                  Inmunoterapia
                </Link>
                <Link className="no-underline transition-colors hover:text-(--ink)" href="#faq">
                  FAQ
                </Link>
                <Link
                  className="no-underline transition-colors hover:text-(--ink)"
                  href="#contacto"
                >
                  Contacto
                </Link>
              </nav>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Button className="h-9 rounded-full bg-(--accent) px-4 text-white" onPress={handleDoctoraliaOpen}>
                  Agendar cita
                </Button>
                <Button
                  aria-label={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
                  className="h-9 w-9 rounded-full border-(--border) text-(--ink-muted)"
                  isIconOnly
                  variant="outline"
                  onPress={toggle}
                >
                  <ThemeIcon theme={theme} />
                </Button>
              </div>
            </div>
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
