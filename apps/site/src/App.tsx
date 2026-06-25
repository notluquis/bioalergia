import { useEffect, useMemo } from "react";
import { usePostHog } from "posthog-js/react";

import { PageShell } from "@/components/PageShell";
import { contactInfo } from "@/data/clinic";
import { legalDocuments, type LegalDocumentKey } from "@/data/legal";
import { doctoraliaLink } from "@/lib/doctoralia";
import { HomePage } from "@/pages/HomePage";
import { LegalPage } from "@/pages/LegalPage";

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
  const whatsappLink = (phone: string) => `https://wa.me/${phone.replace(/\D/g, "")}`;
  const pathname = useMemo(
    () => (typeof window === "undefined" ? "/" : normalizePath(window.location.pathname)),
    []
  );
  const legalDocumentKey = resolveLegalDocument(pathname);
  const legalDocument = legalDocumentKey ? legalDocuments[legalDocumentKey] : null;

  const handleDoctoraliaOpen = () => {
    posthog?.capture("doctoralia_booking_attempt", { location: "app_hero" });
    window.open(doctoraliaLink, "_blank", "noopener,noreferrer");
  };
  const handleWhatsAppOpen = () => {
    posthog?.capture("whatsapp_click", { location: "hero" });
    window.open(whatsappLink(contactInfo.phones[0]), "_blank", "noopener,noreferrer");
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

  if (legalDocument) {
    return (
      <PageShell pathname={pathname}>
        <LegalPage document={legalDocument} />
      </PageShell>
    );
  }

  return (
    <HomePage onBook={handleDoctoraliaOpen} onWhatsApp={handleWhatsAppOpen} pathname={pathname} />
  );
}
