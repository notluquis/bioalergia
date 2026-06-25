import type { ReactNode } from "react";

import { Eyebrow } from "@/components/ui/Eyebrow";

type SectionProps = {
  id?: string;
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  children: ReactNode;
};

/**
 * In-page section block (editorial restyle) — blue eyebrow + Instrument Serif
 * heading + muted lede. Used across content pages; the visual upgrade here
 * cascades to every page that relies on it.
 */
export function Section({ id, eyebrow, title, subtitle, children }: SectionProps) {
  return (
    <section className="grid scroll-mt-36 gap-8" id={id}>
      {(eyebrow || title || subtitle) && (
        <div className="grid gap-3">
          {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
          {title ? (
            <h2 className="font-display text-[2rem] leading-[1.05] text-foreground sm:text-[2.5rem]">
              {title}
            </h2>
          ) : null}
          {subtitle ? (
            <p className="max-w-3xl text-[1.0625rem] leading-[1.6] text-muted">{subtitle}</p>
          ) : null}
        </div>
      )}
      {children}
    </section>
  );
}
