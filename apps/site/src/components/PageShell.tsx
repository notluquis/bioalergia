import type { ReactNode } from "react";

import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { Container } from "@/components/ui/Container";
import { TiendaBanner } from "@/components/ui/TiendaBanner";

/**
 * Content page wrapper — shared editorial header + footer. By default the body
 * is wrapped in the 1200px container with section rhythm; pages that lay out
 * full-width colour bands (SectionBand) pass `contained={false}` and own their
 * own containers.
 */
export function PageShell({
  children,
  contained = true,
  pathname,
}: {
  children: ReactNode;
  contained?: boolean;
  pathname?: string;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TiendaBanner />
      <SiteHeader pathname={pathname} />
      <main className="flex-1">
        {contained ? (
          <Container className="grid gap-16 py-12 sm:py-16">{children}</Container>
        ) : (
          children
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
