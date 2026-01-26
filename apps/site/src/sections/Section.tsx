import { ReactNode } from "react";

type SectionProps = {
  id?: string;
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  children: ReactNode;
};

export function Section({ id, eyebrow, title, subtitle, children }: SectionProps) {
  return (
    <section className="grid gap-6" id={id}>
      {(eyebrow || title || subtitle) && (
        <div className="grid gap-3">
          {eyebrow ? (
            <div className="text-xs uppercase tracking-wide text-[color:var(--ink-muted)]">
              {eyebrow}
            </div>
          ) : null}
          {title ? (
            <h2 className="text-3xl font-semibold text-[color:var(--ink)]">{title}</h2>
          ) : null}
          {subtitle ? (
            <p className="max-w-3xl text-base text-[color:var(--ink-muted)]">{subtitle}</p>
          ) : null}
        </div>
      )}
      {children}
    </section>
  );
}
