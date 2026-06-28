import { createFileRoute, Link, notFound } from "@tanstack/react-router";

import { PageShell } from "@/components/PageShell";
import { PageHero } from "@/components/ui/PageHero";
import { SectionBand } from "@/components/ui/SectionBand";
import { LEGAL } from "@/features/shop/legal-content";

type LegalKey = keyof typeof LEGAL;

function LegalPage() {
  const { slug } = Route.useParams();
  const entry = LEGAL[slug as LegalKey];
  if (!entry) throw notFound();

  return (
    <PageShell contained={false}>
      <PageHero
        crumbs={[{ label: "Inicio", href: "/" }, { label: "Legal" }, { label: entry.title }]}
        eyebrow="Legal"
        title={entry.title}
      />

      <SectionBand borderTop tone="surface">
        <div className="mx-auto max-w-[760px]">
          <div className="border-line border-t pt-8 text-[1.0625rem] text-muted leading-[1.75] whitespace-pre-line">
            {entry.body}
          </div>
          <Link
            className="mt-8 inline-flex w-fit border-line border-t pt-8 font-semibold text-brand-blue text-sm no-underline hover:underline"
            to="/tienda"
          >
            ← Volver a la tienda
          </Link>
        </div>
      </SectionBand>
    </PageShell>
  );
}

export const Route = createFileRoute("/legal/$slug")({
  component: LegalPage,
  head: ({ params }) => {
    const entry = LEGAL[params.slug as LegalKey];
    return {
      meta: [
        { title: entry ? `${entry.title} · Bioalergia` : "Legal · Bioalergia" },
        ...(entry ? [{ name: "description", content: entry.body.slice(0, 160) }] : []),
      ],
    };
  },
});
