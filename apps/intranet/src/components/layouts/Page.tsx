import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { PAGE_CONTAINER, PAGE_CONTAINER_RELAXED } from "@/lib/styles";

interface PageProps {
  readonly children: ReactNode;
  /**
   * `default` — full-width dashboard surface (most pages).
   * `relaxed` — centered, max-width reading column for forms / detail pages.
   */
  readonly variant?: "default" | "relaxed";
  readonly className?: string;
}

/**
 * Standard page shell. Owns the page-level vertical rhythm via the shared
 * `PAGE_CONTAINER` tokens — it does NOT add padding (the app-shell content
 * pane in `_authed.tsx` is the single source of the page inset).
 *
 * Replaces the ad-hoc `<div className={PAGE_CONTAINER}>` wrappers so every
 * page enters through one primitive. Compose with `<PageHeader>` + content:
 *
 * ```tsx
 * <Page>
 *   <PageHeader title="Roles" description="…" actions={<Button>Nuevo</Button>} />
 *   <PageState query={rolesQuery}>{(roles) => <DataTable … />}</PageState>
 * </Page>
 * ```
 */
export function Page({ children, variant = "default", className }: PageProps) {
  return (
    <div className={cn(variant === "relaxed" ? PAGE_CONTAINER_RELAXED : PAGE_CONTAINER, className)}>
      {children}
    </div>
  );
}
