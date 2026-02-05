import { Button, Link, Separator } from "@heroui/react";
import { usePostHog } from "posthog-js/react";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";

import { contactInfo } from "@/data/clinic";
import { doctoraliaLink } from "@/lib/doctoralia";
import { ContactSection } from "@/sections/ContactSection";
// Eager load critical sections (first fold)
import { HeroSection } from "@/sections/HeroSection";

// Lazy load non-critical sections (below the fold)
const MissionSection = lazy(() =>
  import("@/sections/MissionSection").then((m) => ({ default: m.MissionSection })),
);
const FounderSection = lazy(() =>
  import("@/sections/FounderSection").then((m) => ({ default: m.FounderSection })),
);
const ServicesSection = lazy(() =>
  import("@/sections/ServicesSection").then((m) => ({ default: m.ServicesSection })),
);
const ImmunotherapySection = lazy(() =>
  import("@/sections/ImmunotherapySection").then((m) => ({ default: m.ImmunotherapySection })),
);
const LocationSection = lazy(() =>
  import("@/sections/LocationSection").then((m) => ({ default: m.LocationSection })),
);
const FAQSection = lazy(() =>
  import("@/sections/FAQSection").then((m) => ({ default: m.FAQSection })),
);
const GlossarySection = lazy(() =>
  import("@/sections/GlossarySection").then((m) => ({ default: m.GlossarySection })),
);
const DoctoraliaCertificate = lazy(() =>
  import("@/sections/DoctoraliaWidgets").then((m) => ({ default: m.DoctoraliaCertificate })),
);

function useThemePreference() {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") {
      return "light";
    }
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
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
  const posthog = usePostHog();
  const { theme, toggle } = useThemePreference();
  const whatsappLink = (phone: string) => `https://wa.me/${phone.replace(/\D/g, "")}`;

  const handleDoctoraliaOpen = () => {
    posthog?.capture("doctoralia_booking_attempt", { location: "app_header" });
    window.open(doctoraliaLink, "_blank", "noopener,noreferrer");
  };
  const handleWhatsAppOpen = () => {
    posthog?.capture("whatsapp_click", { location: "floating_button" });
    window.open(whatsappLink(contactInfo.phones[0]), "_blank", "noopener,noreferrer");
  };

  const handleEmailClick = (email: string) => {
    posthog?.capture("email_click", { email, location: "app_header" });
    window.location.href = `mailto:${email}`;
  };

  return (
    <div className="relative">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-10 px-4 pt-6 pb-14 sm:px-6 md:gap-12 lg:gap-16 lg:px-8">
        <header className="sticky top-2 z-50 sm:top-3">
          <div className="rounded-2xl border border-border bg-(--surface)/90 shadow-[0_20px_60px_rgba(0,0,0,0.16)] backdrop-blur sm:rounded-3xl">
            <div className="hidden flex-wrap items-center justify-between gap-3 border-border border-b px-4 py-2 text-(--ink-muted) text-xs md:flex lg:px-5">
              <span>Bienvenidos a Bioalergia · Atención especializada en Concepción</span>
              <div className="flex flex-wrap items-center gap-3">
                {contactInfo.phones.map((phone) => (
                  <Link key={phone} className="no-underline" href={whatsappLink(phone)}>
                    {phone}
                  </Link>
                ))}
                <button
                  type="button"
                  className="cursor-pointer text-inherit no-underline hover:underline"
                  onClick={() => handleEmailClick(contactInfo.email)}
                >
                  {contactInfo.email}
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-3 px-4 py-3 sm:px-5 md:flex-row md:items-center md:gap-6 lg:py-4">
              <div className="flex items-center justify-between gap-3 md:justify-start">
                <img
                  src="/logo_sin_eslogan.png"
                  alt="Bioalergia"
                  className="h-9 w-auto sm:h-11 md:h-14"
                  loading="eager"
                />
                <div className="flex items-center gap-2 md:hidden">
                  <Button
                    className="h-8 rounded-full bg-(--accent) px-3 font-semibold text-white text-xs sm:h-9 sm:px-4 sm:text-sm"
                    onPress={handleDoctoraliaOpen}
                  >
                    <span className="sm:hidden">Agendar</span>
                    <span className="hidden sm:inline">Agendar cita</span>
                  </Button>
                  <Button
                    aria-label={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
                    className="h-8 w-8 rounded-full border-border text-(--ink-muted) sm:h-9 sm:w-9"
                    isIconOnly
                    variant="outline"
                    onPress={toggle}
                  >
                    <ThemeIcon theme={theme} />
                  </Button>
                </div>
              </div>
              <nav
                aria-label="Navegación principal"
                className="flex w-full flex-wrap items-center gap-2 text-(--ink-muted) text-xs sm:gap-4 sm:text-sm md:w-auto md:flex-1 md:justify-center md:overflow-visible"
              >
                <Link className="no-underline transition-colors hover:text-(--ink)" href="#inicio">
                  Inicio
                </Link>
                <Link
                  className="no-underline transition-colors hover:text-(--ink)"
                  href="#servicios"
                >
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
              <div className="hidden items-center gap-2 text-sm md:flex">
                <Button
                  className="h-9 rounded-full bg-(--accent) px-4 text-white"
                  onPress={handleDoctoraliaOpen}
                >
                  Agendar cita
                </Button>
                <Button
                  aria-label={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
                  className="h-9 w-9 rounded-full border-border text-(--ink-muted)"
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

          <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-gray-200" />}>
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
          </Suspense>

          <Separator className="opacity-60" />

          <ContactSection />
        </main>
      </div>
      <Button
        aria-label="Escríbenos por WhatsApp"
        className="fixed right-5 bottom-5 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-[#25D366] text-white shadow-[0_18px_40px_rgba(10,20,30,0.25)] ring-2 ring-white/80 transition hover:scale-[1.03] hover:shadow-[0_22px_45px_rgba(10,20,30,0.28)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#25D366]/35 sm:right-7 sm:bottom-7 sm:h-14 sm:w-14"
        isIconOnly
        variant="primary"
        onPress={handleWhatsAppOpen}
      >
        <svg
          aria-hidden="true"
          className="block h-6 w-6 sm:h-7 sm:w-7"
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M20.52 3.48A11.86 11.86 0 0 0 12.03 0C5.39 0 .01 5.37 0 12c0 2.11.55 4.17 1.6 5.99L0 24l6.19-1.62a12.03 12.03 0 0 0 5.83 1.49h.01c6.63 0 12-5.37 12-12 0-3.2-1.25-6.2-3.51-8.39Zm-8.5 18.35h-.01a9.9 9.9 0 0 1-5.05-1.38l-.36-.21-3.67.96.98-3.58-.23-.37a9.9 9.9 0 0 1-1.53-5.24c0-5.44 4.44-9.86 9.9-9.86 2.65 0 5.14 1.03 7.01 2.9a9.83 9.83 0 0 1 2.9 6.99c0 5.44-4.43 9.89-9.94 9.89Zm5.44-7.45c-.3-.15-1.78-.88-2.06-.98-.27-.1-.47-.15-.67.15-.2.3-.77.98-.94 1.18-.17.2-.35.22-.65.07-.3-.15-1.25-.46-2.38-1.46-.88-.78-1.47-1.74-1.64-2.04-.17-.3-.02-.46.13-.61.14-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.6-.92-2.2-.24-.58-.48-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.05 1.03-1.05 2.52 0 1.48 1.08 2.9 1.23 3.1.15.2 2.12 3.23 5.13 4.53.71.31 1.26.5 1.69.64.71.23 1.35.2 1.86.12.57-.08 1.78-.73 2.03-1.44.25-.7.25-1.31.17-1.44-.08-.13-.27-.2-.57-.35Z" />
        </svg>
      </Button>
    </div>
  );
}
