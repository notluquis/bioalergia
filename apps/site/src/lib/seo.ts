import { contactInfo } from "@/data/clinic";

// NOTE: Per-page Open Graph images use the brand `og-image.png` as a consistent
// baseline for every route. Truly unique per-page images would require an image
// generation pipeline (e.g. @vercel/og or satori), which is out of scope here.

export const SITE_ORIGIN = "https://bioalergia.cl";

export function absoluteUrl(path: string): string {
  if (path.startsWith("http")) {
    return path;
  }
  return `${SITE_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;
}

export function clinicJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "MedicalClinic",
    name: "Clínica Bioalergia",
    url: SITE_ORIGIN,
    email: contactInfo.email,
    telephone: contactInfo.phones[0],
    medicalSpecialty: "Allergy",
    address: {
      "@type": "PostalAddress",
      streetAddress: contactInfo.address,
      addressLocality: "Concepción",
      addressRegion: "Biobío",
      addressCountry: "CL",
    },
  };
}

export function physicianJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Physician",
    name: "Dr. José Manuel Martínez Martínez",
    medicalSpecialty: "Allergy",
    description: "Alergólogo e inmunólogo en Concepción, Chile.",
    url: absoluteUrl("/equipo"),
    address: {
      "@type": "PostalAddress",
      addressLocality: "Concepción",
      addressRegion: "Biobío",
      addressCountry: "CL",
    },
    affiliation: {
      "@type": "MedicalClinic",
      name: "Clínica Bioalergia",
      url: SITE_ORIGIN,
    },
  };
}

export function faqJsonLd(items: { question: string; answer: string }[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

export function breadcrumbJsonLd(trail: { name: string; path: string }[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: absoluteUrl(crumb.path),
    })),
  };
}

export function articleJsonLd(a: {
  title: string;
  description: string;
  path: string;
  datePublished?: string;
}): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": ["Article", "MedicalWebPage"],
    headline: a.title,
    description: a.description,
    url: absoluteUrl(a.path),
    ...(a.datePublished ? { datePublished: a.datePublished } : {}),
    publisher: {
      "@type": "MedicalClinic",
      name: "Clínica Bioalergia",
      url: SITE_ORIGIN,
    },
  };
}
