import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface PageHeaderProps {
  readonly title: ReactNode;
  readonly description?: ReactNode;
  /** Right-aligned actions (buttons, menus). Wraps below the title on mobile. */
  readonly actions?: ReactNode;
  /** Optional leading icon. Rendered inside the standard rounded icon-box
   *  (`bg-primary/10 text-primary`). Pass the bare icon, e.g. `<UserCheck size={22} />`.
   *  Replaces the hand-rolled icon-box headers across compliance/settings pages. */
  readonly icon?: ReactNode;
  /** Override the visible heading level. Defaults to `h2` (the page `<h1>` is
   *  the sr-only `RouteHeading` mounted once in the layout). */
  readonly as?: "h1" | "h2" | "h3";
  readonly className?: string;
}

/**
 * Standard page / section header: title + optional description + right-aligned
 * actions. Replaces the 15+ hand-rolled `<h2>`/description blocks across pages
 * so headings share one type ramp and one layout.
 *
 * Renders `h2` by default — the accessible page `<h1>` is the sr-only
 * `RouteHeading` in `_authed.tsx`, so visible headers stay `h2` to keep the
 * document outline correct.
 */
export function PageHeader({
  title,
  description,
  actions,
  icon,
  as: Heading = "h2",
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn("flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between", className)}
    >
      <div className="flex min-w-0 items-start gap-3">
        {icon ? (
          <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            {icon}
          </div>
        ) : null}
        <div className="min-w-0 space-y-1">
          <Heading className="truncate font-semibold text-foreground text-lg">{title}</Heading>
          {description ? <p className="text-default-500 text-sm">{description}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}
