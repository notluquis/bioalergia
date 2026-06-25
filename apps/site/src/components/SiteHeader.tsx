import { Button, Link } from "@heroui/react";
import { usePostHog } from "posthog-js/react";

import { PrimaryNav } from "@/components/PrimaryNav";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { Container } from "@/components/ui/Container";
import { ctaClass } from "@/components/ui/cta";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { UtilityBar } from "@/components/ui/UtilityBar";
import { doctoraliaLink } from "@/lib/doctoralia";

/**
 * Editorial site header (handoff): utility bar + sticky blurred header with the
 * brand mark, primary nav strip, an amber "Agendar hora" CTA and the theme
 * toggle. Single source of truth for the top nav (shared by App + PageShell).
 */
export function SiteHeader({ pathname }: { pathname?: string }) {
  const posthog = usePostHog();

  const handleBook = () => {
    posthog?.capture("doctoralia_booking_attempt", { location: "site_header" });
    window.open(doctoraliaLink, "_blank", "noopener,noreferrer");
  };

  return (
    <>
      <UtilityBar />
      <header className="sticky top-0 z-50 border-line border-b bg-[var(--header-bg)] backdrop-blur-md">
        <Container className="flex items-center justify-between gap-4 py-[14px]">
          <Link aria-label="Bioalergia · Inicio" className="shrink-0" href="/">
            <BrandLogo className="h-9 w-auto" eager />
          </Link>
          <div className="flex items-center gap-3">
            <Button
              className={ctaClass("primary", "h-auto px-[22px] py-[11px] text-sm")}
              onPress={handleBook}
            >
              <span className="hidden sm:inline">Agendar hora</span>
              <span className="sm:hidden">Agendar</span>
            </Button>
            <ThemeToggle />
          </div>
        </Container>
        {/* Full-width nav strip below the brand row (scrollable on mobile). */}
        <PrimaryNav pathname={pathname} />
      </header>
    </>
  );
}
