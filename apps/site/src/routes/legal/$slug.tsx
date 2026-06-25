import { Breadcrumbs } from "@heroui/react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";

import { LEGAL } from "@/features/shop/legal-content";

type LegalKey = keyof typeof LEGAL;

function LegalPage() {
  const { slug } = Route.useParams();
  const entry = LEGAL[slug as LegalKey];
  if (!entry) throw notFound();

  return (
    <main className="mx-auto max-w-[760px] space-y-8 px-4 py-12 sm:px-6 sm:py-16">
      <Breadcrumbs>
        <Breadcrumbs.Item href="/">Inicio</Breadcrumbs.Item>
        <Breadcrumbs.Item>Legal</Breadcrumbs.Item>
        <Breadcrumbs.Item>{entry.title}</Breadcrumbs.Item>
      </Breadcrumbs>

      <header className="grid gap-3">
        <p className="font-bold text-[0.75rem] text-eyebrow uppercase leading-none tracking-[0.16em]">
          Legal
        </p>
        <h1 className="font-display text-[2.5rem] text-foreground leading-[1.04] sm:text-[3rem]">
          {entry.title}
        </h1>
      </header>

      <div className="border-line border-t pt-8 text-[1.0625rem] text-muted leading-[1.75] whitespace-pre-line">
        {entry.body}
      </div>

      <Link
        className="inline-flex w-fit border-line border-t pt-8 font-semibold text-brand-blue text-sm no-underline hover:underline"
        to="/tienda"
      >
        ← Volver a la tienda
      </Link>
    </main>
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
