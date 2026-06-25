import { Breadcrumbs } from "@heroui/react";
import type { ReactNode } from "react";

import { Eyebrow } from "@/components/ui/Eyebrow";

export type Crumb = { label: string; href?: string };

/**
 * Editorial page header — breadcrumbs + blue eyebrow + Instrument Serif H1 +
 * muted lede. The standard top block for every content/legal page (replaces the
 * ad-hoc `<section>` title blocks).
 */
export function PageHeader({
  eyebrow,
  title,
  lede,
  crumbs,
  actions,
}: {
  eyebrow?: string;
  title: string;
  lede?: ReactNode;
  crumbs?: Crumb[];
  actions?: ReactNode;
}) {
  return (
    <header className="grid gap-4">
      {crumbs && crumbs.length > 0 ? (
        <Breadcrumbs>
          {crumbs.map((c) => (
            <Breadcrumbs.Item key={c.label} href={c.href}>
              {c.label}
            </Breadcrumbs.Item>
          ))}
        </Breadcrumbs>
      ) : null}
      <div className="grid gap-3">
        {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
        <h1 className="font-display text-[2.5rem] leading-[1.04] text-foreground sm:text-[3.25rem]">
          {title}
        </h1>
        {lede ? <p className="max-w-3xl text-[1.0625rem] leading-[1.6] text-muted">{lede}</p> : null}
        {actions ? <div className="mt-2 flex flex-wrap items-center gap-3">{actions}</div> : null}
      </div>
    </header>
  );
}
