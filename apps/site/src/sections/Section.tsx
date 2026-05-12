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
    <section className="grid scroll-mt-36 gap-8" id={id}>
      {(eyebrow || title || subtitle) && (
        <div className="grid gap-3">
          {eyebrow ? (
            <div className="text-(--ink-muted) text-xs uppercase tracking-[0.2em]">{eyebrow}</div>
          ) : null}
          {title ? (
            <h2 className="font-semibold text-(--ink) text-3xl sm:text-4xl">{title}</h2>
          ) : null}
          {subtitle ? (
            <p className="max-w-3xl text-(--ink-muted) text-base leading-relaxed sm:text-lg">
              {subtitle}
            </p>
          ) : null}
        </div>
      )}
      {children}
    </section>
  );
}
