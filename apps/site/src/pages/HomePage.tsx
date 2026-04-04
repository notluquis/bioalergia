import { Button, Separator } from "@heroui/react";
import { lazy, Suspense } from "react";

import { ContactSection } from "@/sections/ContactSection";
import { HeroSection } from "@/sections/HeroSection";
import { SiteFooter } from "@/components/SiteFooter";

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

export function HomePage({
  onBook,
  onWhatsApp,
}: {
  onBook: () => void;
  onWhatsApp: () => void;
}) {
  return (
    <>
      <main className="grid gap-20">
        <HeroSection onBook={onBook} />

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

      <SiteFooter />

      <Button
        aria-label="Escríbenos por WhatsApp"
        className="fixed right-5 bottom-5 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-[#25D366] text-white shadow-[0_18px_40px_rgba(10,20,30,0.25)] ring-2 ring-white/80 transition hover:scale-[1.03] hover:shadow-[0_22px_45px_rgba(10,20,30,0.28)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#25D366]/35 sm:right-7 sm:bottom-7 sm:h-14 sm:w-14"
        isIconOnly
        variant="primary"
        onPress={onWhatsApp}
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
    </>
  );
}

