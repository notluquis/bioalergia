import { lazy, Suspense } from "react";

import { JsonLd } from "@/components/JsonLd";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { TiendaBanner } from "@/components/ui/TiendaBanner";
import { HeroSection } from "@/sections/HeroSection";
import { WayfindingSection } from "@/sections/WayfindingSection";
import { faqItems } from "@/data/faq";
import { clinicJsonLd, faqJsonLd } from "@/lib/seo";

const ProcessSection = lazy(() =>
  import("@/sections/ProcessSection").then((m) => ({ default: m.ProcessSection }))
);
const ImmunotherapySection = lazy(() =>
  import("@/sections/ImmunotherapySection").then((m) => ({ default: m.ImmunotherapySection }))
);
const ServicesSection = lazy(() =>
  import("@/sections/ServicesSection").then((m) => ({ default: m.ServicesSection }))
);
const FounderSection = lazy(() =>
  import("@/sections/FounderSection").then((m) => ({ default: m.FounderSection }))
);
const LocationSection = lazy(() =>
  import("@/sections/LocationSection").then((m) => ({ default: m.LocationSection }))
);
const FAQSection = lazy(() =>
  import("@/sections/FAQSection").then((m) => ({ default: m.FAQSection }))
);
const ClosingCtaSection = lazy(() =>
  import("@/sections/ClosingCtaSection").then((m) => ({ default: m.ClosingCtaSection }))
);

/**
 * Patient home — editorial vertical stack of full-width bands, recreated from
 * the 2026 design handoff: hero → wayfinding → process → immunotherapy →
 * services → founder → visit → FAQ → closing CTA.
 */
export function HomePage({
  onBook,
  onWhatsApp,
  pathname,
}: {
  onBook: () => void;
  onWhatsApp: () => void;
  pathname?: string;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <JsonLd data={clinicJsonLd()} />
      <JsonLd data={faqJsonLd(faqItems)} />
      <TiendaBanner />
      <SiteHeader pathname={pathname} />
      <main className="flex-1">
        <HeroSection onBook={onBook} onWhatsApp={onWhatsApp} />
        <WayfindingSection onBook={onBook} />
        <Suspense fallback={<div className="h-64 animate-pulse bg-surface-2" />}>
          <ProcessSection />
          <ImmunotherapySection />
          <ServicesSection />
          <FounderSection />
          <LocationSection />
          <FAQSection />
          <ClosingCtaSection onBook={onBook} onWhatsApp={onWhatsApp} />
        </Suspense>
      </main>
      <SiteFooter />
    </div>
  );
}
