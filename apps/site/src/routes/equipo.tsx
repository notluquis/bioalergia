import { Link } from "@heroui/react";
import { createFileRoute } from "@tanstack/react-router";

import { BookingCta } from "@/components/BookingCta";
import { JsonLd } from "@/components/JsonLd";
import { PageShell } from "@/components/PageShell";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { PageHero } from "@/components/ui/PageHero";
import { Photo } from "@/components/ui/Photo";
import { SectionBand } from "@/components/ui/SectionBand";
import { clinicOverview } from "@/data/clinic";
import { team } from "@/data/team";
import { breadcrumbJsonLd, physicianJsonLd } from "@/lib/seo";

function EquipoPage() {
  return (
    <PageShell contained={false}>
      <JsonLd data={physicianJsonLd()} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Inicio", path: "/" },
          { name: "Equipo", path: "/equipo" },
        ])}
      />
      <PageHero
        crumbs={[{ label: "Inicio", href: "/" }, { label: "Equipo" }]}
        eyebrow="Equipo"
        lede="Experiencia clínica en alergología e inmunología, gestión cercana y plataformas digitales propias: un equipo pequeño que cuida cada detalle de tu atención."
        photo="doctorDesk"
        title="Nuestro equipo"
      />

      <SectionBand borderTop tone="surface2">
        <Eyebrow className="mb-3">Quiénes somos</Eyebrow>
        <h2 className="mb-10 max-w-2xl font-display text-[2rem] leading-[1.05] text-foreground sm:text-[2.5rem]">
          Las personas detrás de Bioalergia.
        </h2>
        <div className="grid gap-12">
          {team.map((member, i) => (
            <article
              className={`grid gap-6 lg:grid-cols-[0.85fr_1.15fr] lg:gap-12 ${i > 0 ? "border-line border-t pt-12" : ""}`}
              key={member.name}
            >
              <div>
                {member.photo ? (
                  <Photo
                    className="mb-5 h-[300px] rounded-md sm:h-[340px] lg:h-[380px]"
                    name={member.photo}
                    sizes="(min-width: 1024px) 420px, 100vw"
                  />
                ) : null}
                <h3 className="font-display text-[1.75rem] text-foreground leading-[1.15]">
                  {member.name}
                </h3>
                <p className="mt-2 text-eyebrow text-sm uppercase tracking-[0.18em]">
                  {member.role}
                </p>
                {member.email || member.linkedin ? (
                  <div className="mt-4 flex flex-wrap items-center gap-4">
                    {member.email ? (
                      <Link
                        className="font-semibold text-brand-blue text-sm no-underline hover:underline"
                        href={`mailto:${member.email}`}
                      >
                        {member.email}
                      </Link>
                    ) : null}
                    {member.linkedin ? (
                      <Link
                        className="font-semibold text-brand-blue text-sm no-underline hover:underline"
                        href={member.linkedin}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        LinkedIn
                        <Link.Icon />
                      </Link>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <div className="grid gap-4">
                {member.paragraphs.map((paragraph) => (
                  <p
                    className="max-w-[62ch] text-[1.0625rem] text-muted leading-[1.7]"
                    key={paragraph.slice(0, 40)}
                  >
                    {paragraph}
                  </p>
                ))}
              </div>
            </article>
          ))}
        </div>
      </SectionBand>

      <SectionBand tone="surface">
        <Eyebrow className="mb-3">Cómo trabajamos</Eyebrow>
        <h2 className="mb-10 max-w-2xl font-display text-[2rem] leading-[1.05] text-foreground sm:text-[2.5rem]">
          Tres principios, en cada consulta.
        </h2>
        <div className="grid gap-x-10 gap-y-8 sm:grid-cols-3">
          {clinicOverview.pillars.map((pillar) => (
            <div className="border-brand-amber border-t-2 pt-4" key={pillar.title}>
              <h3 className="font-display text-[1.4rem] text-foreground">{pillar.title}</h3>
              <p className="mt-2 text-muted leading-relaxed">{pillar.detail}</p>
            </div>
          ))}
        </div>
      </SectionBand>

      <SectionBand tone="bg">
        <div className="grid gap-x-12 gap-y-8 lg:grid-cols-2">
          <div>
            <Eyebrow className="mb-3">Misión</Eyebrow>
            <p className="max-w-[52ch] text-[1.125rem] text-foreground leading-[1.6]">
              {clinicOverview.mission}
            </p>
          </div>
          <div>
            <Eyebrow className="mb-3">Visión</Eyebrow>
            <p className="max-w-[52ch] text-[1.125rem] text-foreground leading-[1.6]">
              {clinicOverview.vision}
            </p>
          </div>
        </div>
      </SectionBand>

      <SectionBand borderTop tone="surface2">
        <BookingCta
          title="Agenda con nuestro especialista"
          description="Reserva una evaluación y conversa tu caso con el Dr. Martínez. Definimos juntos el estudio y el tratamiento que mejor se adaptan a ti."
          location="equipo_page"
        />
      </SectionBand>
    </PageShell>
  );
}

export const Route = createFileRoute("/equipo")({
  component: EquipoPage,
  head: () => {
    const origin = typeof window === "undefined" ? "https://bioalergia.cl" : window.location.origin;
    const url = `${origin}/equipo`;
    return {
      meta: [
        { title: "Nuestro equipo · Bioalergia" },
        {
          name: "description",
          content:
            "Conoce al equipo de Bioalergia: el Dr. José Manuel Martínez, alergólogo e inmunólogo en Concepción, y el equipo de coordinación y desarrollo que sostiene la clínica.",
        },
        { property: "og:title", content: "Nuestro equipo · Bioalergia" },
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
