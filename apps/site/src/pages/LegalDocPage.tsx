import { Link } from "@heroui/react";

import { PageShell } from "@/components/PageShell";
import { PageHero } from "@/components/ui/PageHero";
import { SectionBand } from "@/components/ui/SectionBand";
import { legalOwner, type LegalDocument } from "@/data/legal";

/**
 * Privacy / Terms / Data-deletion renderer — prose, not the old card-per-section
 * layout. Mirrors the editorial guide style (PageHero + plain headed sections)
 * so the legal pages match the rest of the site. Driven by `data/legal.ts`.
 */
export function LegalDocPage({ document }: { document: LegalDocument }) {
  return (
    <PageShell contained={false}>
      <PageHero
        crumbs={[{ label: "Inicio", href: "/" }, { label: "Legal" }, { label: document.eyebrow }]}
        eyebrow={document.eyebrow}
        lede={document.summary}
        title={document.title}
      />

      <SectionBand borderTop tone="surface">
        <div className="mx-auto max-w-[820px]">
          {/* Key facts — a plain definition list, not a grid of cards. */}
          <dl className="grid gap-x-8 gap-y-4 border-line border-b pb-8 sm:grid-cols-2">
            {document.highlights.map((item) => (
              <div key={item.label}>
                <dt className="text-[11px] text-eyebrow uppercase tracking-[0.16em]">
                  {item.label}
                </dt>
                <dd className="mt-1 font-semibold text-foreground text-sm">{item.value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-10 grid gap-10">
            {document.sections.map((section) => (
              <section className="scroll-mt-28 grid gap-3" id={section.id} key={section.id}>
                <h2 className="font-display text-[1.6rem] text-foreground leading-[1.15]">
                  {section.title}
                </h2>
                {section.paragraphs?.map((paragraph) => (
                  <p className="text-[1.0625rem] text-muted leading-[1.7]" key={paragraph}>
                    {paragraph}
                  </p>
                ))}
                {section.bullets ? (
                  <ul className="grid list-disc gap-2 pl-5 text-[1.0625rem] text-muted leading-[1.7]">
                    {section.bullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))}
          </div>

          <div className="mt-10 border-line border-t pt-8">
            <h2 className="font-display text-[1.3rem] text-foreground">Referencias oficiales</h2>
            <ul className="mt-4 grid gap-3">
              {document.references.map((reference) => (
                <li className="text-sm leading-relaxed" key={reference.href}>
                  <Link
                    className="text-brand-blue"
                    href={reference.href}
                    rel="noreferrer"
                    target={reference.href.startsWith("http") ? "_blank" : undefined}
                  >
                    {reference.label}
                  </Link>
                  {reference.note ? <span className="text-muted"> — {reference.note}</span> : null}
                </li>
              ))}
            </ul>
          </div>

          <p className="mt-10 border-line border-t pt-8 text-muted text-sm">
            Última actualización: {document.lastUpdated} · Vigencia: {document.effectiveDate}. Para
            un requerimiento formal escribe a{" "}
            <Link className="text-brand-blue" href={`mailto:${legalOwner.privacyEmail}`}>
              {legalOwner.privacyEmail}
            </Link>
            .
          </p>
        </div>
      </SectionBand>
    </PageShell>
  );
}
