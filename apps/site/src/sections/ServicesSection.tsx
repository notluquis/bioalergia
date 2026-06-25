import { Link } from "@heroui/react";

import { SectionBand } from "@/components/ui/SectionBand";
import { ctaClass } from "@/components/ui/cta";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Photo } from "@/components/ui/Photo";

const cards = [
  {
    eyebrow: "Consulta",
    title: "Consulta especializada",
    body: "Te atiende el especialista, te explica qué tienes y qué hacer. Para grandes y chicos.",
    href: "/servicios",
  },
  {
    eyebrow: "Tratamiento",
    title: "Inmunoterapia (vacunas)",
    body: "Vacunas para la alergia, inyectables o en gotas, que atacan la causa y no solo el síntoma.",
    href: "/inmunoterapia",
  },
  {
    eyebrow: "Empresas",
    title: "Salud ocupacional",
    body: "Exámenes y prevención de alergias para empresas y sus equipos de trabajo.",
    href: "/salud-ocupacional",
  },
  {
    eyebrow: "Tienda",
    title: "Botiquín y productos",
    body: "Lo que necesitas para el día a día, con despacho a todo Chile vía Chilexpress.",
    href: "/botiquin",
  },
];

/** Services (handoff) — asymmetric grid: tall photo cell + four text cards. */
export function ServicesSection() {
  return (
    <SectionBand id="servicios" tone="bg">
      <div className="mb-9 flex items-end justify-between gap-6">
        <div>
          <Eyebrow className="mb-4">Lo que hacemos</Eyebrow>
          <h2 className="font-display text-[2.25rem] leading-[1.05] text-foreground sm:text-[2.75rem]">
            Todo lo de tu alergia, en un solo lugar.
          </h2>
        </div>
        <Link className={ctaClass("link", "whitespace-nowrap text-sm")} href="/servicios">
          Ver todos los servicios →
        </Link>
      </div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-[1.15fr_1fr_1fr]">
        {/* Tall photo cell — spans two rows on lg. */}
        <Link
          aria-label="Exámenes: test cutáneo y de parche"
          className="group relative row-span-2 block min-h-[420px] overflow-hidden rounded-[10px]"
          href="/examenes"
        >
          <Photo
            className="absolute inset-0 size-full"
            imgClassName="transition-transform duration-500 group-hover:scale-[1.03]"
            name="patchBack"
            rounded="rounded-none"
            sizes="(min-width: 1024px) 420px, 100vw"
          />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-brand-blue-deep/95 via-brand-blue-deep/55 to-transparent p-7">
            <Eyebrow className="mb-2" tone="amber">
              Exámenes
            </Eyebrow>
            <h3 className="mb-1.5 font-display text-[1.6875rem] text-white">
              Test cutáneo y de parche
            </h3>
            <p className="text-[0.875rem] leading-[1.5] text-[#dce6f2]">
              Identificamos exactamente a qué eres alérgico, sin andar adivinando.
            </p>
          </div>
        </Link>

        {cards.map((card) => (
          <Link
            key={card.title}
            className="flex min-h-[198px] flex-col justify-between rounded-[10px] border border-line bg-surface p-7 transition-colors hover:border-brand-amber"
            href={card.href}
          >
            <div>
              <Eyebrow className="mb-3 text-[0.69rem]">{card.eyebrow}</Eyebrow>
              <h3 className="mb-2 font-display text-[1.4375rem] text-foreground">{card.title}</h3>
              <p className="text-[0.875rem] leading-[1.5] text-muted">{card.body}</p>
            </div>
            <span className="mt-3.5 self-end text-[1.125rem] text-brand-amber">→</span>
          </Link>
        ))}
      </div>
    </SectionBand>
  );
}
