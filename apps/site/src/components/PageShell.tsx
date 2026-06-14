import type { ReactNode } from "react";

import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

/**
 * Marketing/content page wrapper: shared header + footer + the same
 * max-width container the homepage (App.tsx) uses, so content routes
 * (/examenes, /inmunoterapia, /polen, ...) feel consistent with `/`.
 */
export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-10 px-4 pt-6 pb-14 sm:px-6 md:gap-12 lg:gap-16 lg:px-8">
      <SiteHeader />
      <main className="grid gap-16">{children}</main>
      <SiteFooter />
    </div>
  );
}
