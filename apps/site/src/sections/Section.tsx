import type { ReactNode } from "react";

type SectionProps = {
  id?: string;
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  children: ReactNode;
};

export function Section({ id, eyebrow, title, subtitle, children }: SectionProps) {
  return (
    <section className="grid gap-8 scroll-mt-36" id={id}>
      {(eyebrow || title || subtitle) && (
        <div className="grid gap-3">
          {eyebrow ? (
            <div className="text-xs uppercase tracking-[0.2em] text-(--ink-muted)">
              {eyebrow}
            </div>
          ) : null}
          {title ? (
            <h2 className="text-3xl font-semibold text-(--ink) sm:text-4xl">{title}</h2>
          ) : null}
          {subtitle ? (
            <p className="max-w-3xl text-base leading-relaxed text-(--ink-muted) sm:text-lg">
              {subtitle}
            </p>
          ) : null}
        </div>
      )}
      {children}
    </section>
  );
}
