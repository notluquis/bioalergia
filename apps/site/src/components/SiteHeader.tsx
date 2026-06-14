import { Button, Link } from "@heroui/react";
import { useTheme } from "next-themes";
import { usePostHog } from "posthog-js/react";

import { contactInfo } from "@/data/clinic";
import { primaryNav } from "@/data/navigation";
import { doctoraliaLink } from "@/lib/doctoralia";

function ThemeIcon({ theme }: { theme: "light" | "dark" }) {
  return theme === "dark" ? (
    <svg
      aria-hidden="true"
      className="size-4"
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
      className="size-4"
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

const whatsappLink = (phone: string) => `https://wa.me/${phone.replace(/\D/g, "")}`;

/**
 * Shared sticky site header. Single source of truth for primary nav.
 * Self-contained (theme + doctoralia handlers) so any route can use it.
 * The homepage (App.tsx) keeps its own bespoke header; content routes use this.
 */
export function SiteHeader() {
  const posthog = usePostHog();
  const { resolvedTheme, setTheme } = useTheme();
  const theme = (resolvedTheme === "dark" ? "dark" : "light") as "dark" | "light";
  const toggle = () => setTheme(theme === "dark" ? "light" : "dark");

  const handleDoctoraliaOpen = () => {
    posthog?.capture("doctoralia_booking_attempt", { location: "site_header" });
    window.open(doctoraliaLink, "_blank", "noopener,noreferrer");
  };

  return (
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
            <Link
              className="cursor-pointer text-inherit no-underline hover:underline"
              href={`mailto:${contactInfo.email}`}
            >
              {contactInfo.email}
            </Link>
          </div>
        </div>
        <div className="flex flex-col gap-3 px-4 py-3 sm:px-5 md:flex-row md:items-center md:gap-6 lg:py-4">
          <div className="flex items-center justify-between gap-3 md:justify-start">
            <Link href="/">
              <img
                src="/logo_sin_eslogan.png"
                alt="Bioalergia"
                className="h-9 w-auto sm:h-11 md:h-14"
                loading="eager"
              />
            </Link>

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
                className="rounded-full border-border text-(--ink-muted) size-8 sm:size-9"
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
            {primaryNav.map((item) => (
              <Link
                key={item.href}
                className={
                  item.accent
                    ? "no-underline font-semibold text-(--accent) transition-colors hover:text-(--ink)"
                    : "no-underline transition-colors hover:text-(--ink)"
                }
                href={item.href}
              >
                {item.label}
              </Link>
            ))}
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
              className="rounded-full border-border text-(--ink-muted) size-9"
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
  );
}
