import { Breadcrumbs } from "@heroui/react";
import type { ReactNode } from "react";

import { Container } from "@/components/ui/Container";
import { type ClinicPhotoName } from "@/data/photos";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { MoleculeMotif } from "@/components/ui/MoleculeMotif";
import { Photo } from "@/components/ui/Photo";

export type Crumb = { label: string; href?: string };

/**
 * Full-width editorial page hero — the content-page counterpart of the home
 * hero. Eyebrow + Instrument Serif H1 + lede on the left; the right column holds
 * a clinic photo when given, otherwise a resolved molecular graphic so every
 * hero reads balanced. Pages render it as their first band (PageShell
 * `contained={false}`).
 */
export function PageHero({
  eyebrow,
  title,
  lede,
  crumbs,
  actions,
  photo,
}: {
  eyebrow?: string;
  title: string;
  lede?: ReactNode;
  crumbs?: Crumb[];
  actions?: ReactNode;
  photo?: ClinicPhotoName;
}) {
  return (
    <section className="relative overflow-hidden bg-background">
      {photo ? (
        <MoleculeMotif className="pointer-events-none absolute top-[-40px] right-[-30px] size-[420px] text-[#c9d8ea] opacity-30" />
      ) : null}
      <Container className="relative grid items-center gap-10 py-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14 lg:py-[4.5rem]">
        <div>
          {crumbs && crumbs.length > 0 ? (
            <Breadcrumbs className="mb-5">
              {crumbs.map((c) => (
                <Breadcrumbs.Item key={c.label} href={c.href}>
                  {c.label}
                </Breadcrumbs.Item>
              ))}
            </Breadcrumbs>
          ) : null}
          {eyebrow ? <Eyebrow className="mb-4">{eyebrow}</Eyebrow> : null}
          <h1 className="font-display text-[2.5rem] leading-[1.04] text-foreground sm:text-[3.25rem]">
            {title}
          </h1>
          {lede ? (
            <p className="mt-5 max-w-[520px] text-[1.0625rem] leading-[1.6] text-muted">{lede}</p>
          ) : null}
          {actions ? <div className="mt-7 flex flex-wrap items-center gap-4">{actions}</div> : null}
        </div>
        {photo ? (
          <Photo
            className="page-hero-photo h-[300px] rounded-md lg:h-[420px]"
            eager
            name={photo}
            sizes="(min-width: 1024px) 540px, 100vw"
          />
        ) : (
          // No photo → a resolved molecular graphic owns the right column so the
          // hero reads intentional, not a half-empty band with floating dots.
          <div aria-hidden="true" className="hidden justify-center lg:flex">
            <MoleculeMotif className="size-[360px] text-[#c9d8ea] opacity-60 dark:opacity-40" />
          </div>
        )}
      </Container>
    </section>
  );
}
