import { Breadcrumbs, Card } from "@heroui/react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";

import { LEGAL } from "@/features/shop/legal-content";

type LegalKey = keyof typeof LEGAL;

function LegalPage() {
  const { slug } = Route.useParams();
  const entry = LEGAL[slug as LegalKey];
  if (!entry) throw notFound();

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <Breadcrumbs>
        <Breadcrumbs.Item href="/">Inicio</Breadcrumbs.Item>
        <Breadcrumbs.Item>Legal</Breadcrumbs.Item>
        <Breadcrumbs.Item>{entry.title}</Breadcrumbs.Item>
      </Breadcrumbs>

      <header>
        <h1 className="font-bold text-3xl">{entry.title}</h1>
      </header>

      <Card>
        <Card.Content className="prose prose-sm max-w-none whitespace-pre-line">
          {entry.body}
        </Card.Content>
      </Card>

      <Link className="text-foreground/60 text-sm hover:underline" to="/tienda">
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
