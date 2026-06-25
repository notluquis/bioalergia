import type { ReactNode } from "react";

import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

/**
 * Shell for shop + account routes — the shared editorial header + footer wrap
 * the view, but (unlike PageShell) it imposes NO width container, so the
 * storefront keeps its own wider grid (`max-w-7xl`). The child view renders its
 * own `<main>`; this only adds the site chrome the shop was missing.
 */
export function ShopShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <div className="flex-1">{children}</div>
      <SiteFooter />
    </div>
  );
}
