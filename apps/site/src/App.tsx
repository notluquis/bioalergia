import { Button, Link } from "@heroui/react";
import { useTheme } from "next-themes";
import { usePostHog } from "posthog-js/react";
import { useEffect, useMemo } from "react";

import { PrimaryNav } from "@/components/PrimaryNav";
import { contactInfo } from "@/data/clinic";
import { legalDocuments, type LegalDocumentKey } from "@/data/legal";
import { doctoraliaLink } from "@/lib/doctoralia";
import { HomePage } from "@/pages/HomePage";
import { LegalPage } from "@/pages/LegalPage";

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

function normalizePath(pathname: string) {
  if (!pathname || pathname === "/") {
    return "/";
  }
  const normalized = pathname.replace(/\/+$/, "");
  return normalized.length === 0 ? "/" : normalized;
}

function resolveLegalDocument(pathname: string): LegalDocumentKey | null {
  switch (normalizePath(pathname)) {
    case "/privacy":
    case "/privacy-policy":
      return "privacy";
    case "/terms":
    case "/terms-of-service":
      return "terms";
    case "/data-deletion":
    case "/data-deletion-instructions":
    case "/user-data-deletion":
      return "dataDeletion";
    default:
      return null;
  }
}

function setMetaTag(selector: string, attribute: "content" | "href", value: string) {
  let element = document.head.querySelector(selector) as HTMLLinkElement | HTMLMetaElement | null;

  if (!element) {
    element = selector.includes("canonical")
      ? document.createElement("link")
      : document.createElement("meta");

    if (element instanceof HTMLLinkElement) {
      element.rel = "canonical";
    } else {
      const propertyMatch = selector.match(/property="([^"]+)"/);
      const nameMatch = selector.match(/name="([^"]+)"/);
      if (propertyMatch) {
        element.setAttribute("property", propertyMatch[1]);
      }
      if (nameMatch) {
        element.setAttribute("name", nameMatch[1]);
      }
    }
    document.head.appendChild(element);
  }

  element.setAttribute(attribute, value);
}

export function App() {
  const posthog = usePostHog();
  const { resolvedTheme, setTheme } = useTheme();
  const theme = (resolvedTheme === "dark" ? "dark" : "light") as "dark" | "light";
  const toggle = () => setTheme(theme === "dark" ? "light" : "dark");
  const whatsappLink = (phone: string) => `https://wa.me/${phone.replace(/\D/g, "")}`;
  const pathname = useMemo(
    () => (typeof window === "undefined" ? "/" : normalizePath(window.location.pathname)),
    []
  );
  const legalDocumentKey = resolveLegalDocument(pathname);
  const legalDocument = legalDocumentKey ? legalDocuments[legalDocumentKey] : null;

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
  };

  useEffect(() => {
    const title = legalDocument?.seoTitle ?? "Bioalergia · Alergología e Inmunología";
    const description =
      legalDocument?.seoDescription ??
      "Consulta de alergología e inmunología en Concepción. Diagnóstico preciso, tratamientos modernos y seguimiento personalizado.";
    const canonicalUrl = `https://bioalergia.cl${legalDocument?.canonicalPath ?? "/"}`;

    document.title = title;
    setMetaTag('meta[name="description"]', "content", description);
    setMetaTag('meta[property="og:title"]', "content", title);
    setMetaTag('meta[property="og:description"]', "content", description);
    setMetaTag('meta[property="og:url"]', "content", canonicalUrl);
    setMetaTag('meta[name="twitter:title"]', "content", title);
    setMetaTag('meta[name="twitter:description"]', "content", description);
    setMetaTag('meta[property="og:image"]', "content", `https://bioalergia.cl/og-image.png`);
    setMetaTag('meta[name="twitter:image"]', "content", `https://bioalergia.cl/og-image.png`);
    setMetaTag('meta[name="twitter:card"]', "content", "summary_large_image");
    setMetaTag('link[rel="canonical"]', "href", canonicalUrl);
  }, [legalDocument]);

  return (
    <div className="relative">
      {/* Promo banner — driver al storefront. Aparece solo en landing
          (App.tsx); rutas /tienda /producto /carrito /checkout no lo
          repiten porque la cinta sería redundante. */}
      <a
        className="flex items-center justify-center gap-2 bg-(--accent) px-4 py-2 text-center font-semibold text-sm text-white no-underline transition hover:brightness-110"
        href="/tienda"
      >
        <span>🛍 Visita nuestra tienda</span>
        <span aria-hidden className="opacity-80">
          — productos seleccionados, envío a todo Chile vía Chilexpress →
        </span>
      </a>
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
                <Link
                  className="cursor-pointer text-inherit no-underline hover:underline"
                  href={`mailto:${contactInfo.email}`}
                  onClick={() => handleEmailClick(contactInfo.email)}
                >
                  {contactInfo.email}
                </Link>
              </div>
            </div>
            {/* Row 1: brand + actions */}
            <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
              <Link href="/">
                <img
                  src="/logo_sin_eslogan.png"
                  alt="Bioalergia"
                  className="h-9 w-auto sm:h-11 md:h-14"
                  loading="eager"
                />
              </Link>
              <div className="flex items-center gap-2">
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

            {/* Row 2: full-width nav */}
            {legalDocument ? (
              <nav
                aria-label="Navegación principal"
                className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-border border-t px-4 py-2.5 text-(--ink-muted) text-sm lg:px-5"
              >
                <Link className="no-underline transition-colors hover:text-(--ink)" href="/">
                  Inicio
                </Link>
                <Link
                  className="no-underline transition-colors hover:text-(--ink)"
                  href={legalDocuments.privacy.canonicalPath}
                >
                  Privacidad
                </Link>
                <Link
                  className="no-underline transition-colors hover:text-(--ink)"
                  href={legalDocuments.terms.canonicalPath}
                >
                  Términos
                </Link>
                <Link
                  className="no-underline transition-colors hover:text-(--ink)"
                  href={legalDocuments.dataDeletion.canonicalPath}
                >
                  Eliminación de datos
                </Link>
              </nav>
            ) : (
              <PrimaryNav pathname={pathname} />
            )}
          </div>
        </header>

        {legalDocument ? (
          <LegalPage document={legalDocument} />
        ) : (
          <HomePage onBook={handleDoctoraliaOpen} onWhatsApp={handleWhatsAppOpen} />
        )}
      </div>
    </div>
  );
}
