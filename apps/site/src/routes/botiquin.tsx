import { Card, Chip, Link, Separator } from "@heroui/react";
import { createFileRoute } from "@tanstack/react-router";

import { BookingCta } from "@/components/BookingCta";
import { JsonLd } from "@/components/JsonLd";
import { PageShell } from "@/components/PageShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { botiquinContent } from "@/data/botiquin";
import { breadcrumbJsonLd } from "@/lib/seo";

function BotiquinPage() {
  return (
    <PageShell>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Inicio", path: "/" },
          { name: "Botiquín", path: "/botiquin" },
        ])}
      />
      <PageHeader
        crumbs={[{ label: "Inicio", href: "/" }, { label: "Botiquín" }]}
        eyebrow="Guía práctica"
        lede={botiquinContent.intro}
        title="Botiquín del alérgico"
      />

      {botiquinContent.groups.map((group) => (
        <section className="grid gap-6" key={group.category}>
          <div className="grid gap-3">
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-brand-amber size-2.5" />
              <h2 className="font-display text-[1.75rem] text-foreground sm:text-[2rem]">
                {group.category}
              </h2>
            </div>
            <p className="max-w-3xl text-muted text-sm leading-relaxed sm:text-base">
              {group.intro}
            </p>
            <Separator />
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {group.items.map((item) => (
              <Card className="rounded-3xl" key={item.name} variant="default">
                <Card.Header className="gap-3">
                  <div className="flex items-center justify-between gap-3">
                    <Card.Title className="text-lg">{item.name}</Card.Title>
                    <Chip size="sm" variant="secondary">
                      {group.category}
                    </Chip>
                  </div>
                  <Card.Description className="text-(--ink-muted) leading-relaxed">
                    {item.why}
                  </Card.Description>
                </Card.Header>
                <Card.Content className="grid gap-4 pb-6">
                  {item.note ? (
                    <div className="grid gap-1 rounded-2xl bg-surface-2 p-4 text-sm leading-relaxed">
                      <span className="font-semibold text-foreground">Importante</span>
                      <span className="text-muted">{item.note}</span>
                    </div>
                  ) : null}
                  {item.shopHref ? (
                    <Link className="w-fit underline-offset-4" href={item.shopHref}>
                      Ver en la tienda
                      <Link.Icon />
                    </Link>
                  ) : null}
                </Card.Content>
              </Card>
            ))}
          </div>
        </section>
      ))}

      <section className="grid gap-3">
        <Card className="rounded-3xl" variant="secondary">
          <Card.Header className="gap-2">
            <Card.Title className="text-lg">Una nota de seguridad</Card.Title>
            <Card.Description className="text-(--ink-muted) leading-relaxed">
              {botiquinContent.safetyNote}
            </Card.Description>
          </Card.Header>
        </Card>
      </section>

      <BookingCta
        title="¿Quieres armar tu botiquín a tu medida?"
        description="En consulta definimos qué medidas de control ambiental, medicamentos y plan de emergencia se ajustan a tu diagnóstico y a tu día a día."
        location="botiquin_page"
      />
    </PageShell>
  );
}

export const Route = createFileRoute("/botiquin")({
  component: BotiquinPage,
  head: () => {
    const origin = typeof window === "undefined" ? "https://bioalergia.cl" : window.location.origin;
    const url = `${origin}/botiquin`;
    return {
      meta: [
        { title: "Botiquín del alérgico · Bioalergia" },
        {
          name: "description",
          content:
            "Guía educativa del botiquín para alergias: control ambiental, higiene nasal, alivio sintomático, emergencia y cuidado de la piel. Personalízalo con tu médico en Concepción.",
        },
        { property: "og:title", content: "Botiquín del alérgico · Bioalergia" },
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
        { property: "og:image", content: `${origin}/og-image.png` },
        { name: "twitter:image", content: `${origin}/og-image.png` },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
});
