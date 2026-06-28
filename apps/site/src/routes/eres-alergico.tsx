import { createFileRoute } from "@tanstack/react-router";

import { BookingCta } from "@/components/BookingCta";
import { ConditionQuiz } from "@/components/ConditionQuiz";
import { JsonLd } from "@/components/JsonLd";
import { PageShell } from "@/components/PageShell";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { PageHero } from "@/components/ui/PageHero";
import { SectionBand } from "@/components/ui/SectionBand";
import { quizContent } from "@/data/quiz";
import { breadcrumbJsonLd } from "@/lib/seo";

function EresAlergicoPage() {
  return (
    <PageShell contained={false}>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Inicio", path: "/" },
          { name: "¿Eres alérgico?", path: "/eres-alergico" },
        ])}
      />
      <PageHero
        crumbs={[{ label: "Inicio", href: "/" }, { label: "¿Eres alérgico?" }]}
        eyebrow="Autoevaluación"
        lede="Responde ocho preguntas rápidas sobre tus síntomas y antecedentes. Al terminar verás una orientación que te ayudará a decidir si conviene una evaluación con un especialista. Nada de lo que respondas se guarda ni se envía: todo ocurre en tu navegador."
        photo="prickGrid"
        title="¿Eres alérgico? Haz tu autoevaluación"
      />

      <SectionBand borderTop tone="surface2">
        <Eyebrow className="mb-3">Cuestionario</Eyebrow>
        <h2 className="mb-9 max-w-2xl font-display text-[2rem] leading-[1.05] text-foreground sm:text-[2.5rem]">
          Ocho preguntas, una orientación.
        </h2>
        <ConditionQuiz
          content={quizContent}
          resultFooter={
            <BookingCta
              title="Da el siguiente paso con un especialista"
              description="Agenda una evaluación y, con el estudio adecuado, identifiquemos qué desencadena tus síntomas y el tratamiento que mejor se adapta a ti."
              location="quiz_result"
            />
          }
        />
      </SectionBand>
    </PageShell>
  );
}

export const Route = createFileRoute("/eres-alergico")({
  component: EresAlergicoPage,
  head: () => {
    const origin = typeof window === "undefined" ? "https://bioalergia.cl" : window.location.origin;
    const url = `${origin}/eres-alergico`;
    return {
      meta: [
        { title: "¿Eres alérgico? Autoevaluación · Bioalergia" },
        {
          name: "description",
          content:
            "Autoevaluación referencial de síntomas alérgicos: responde 8 preguntas y conoce si conviene una evaluación con un especialista en alergias en Concepción. No es un diagnóstico médico.",
        },
        { property: "og:title", content: "¿Eres alérgico? Autoevaluación · Bioalergia" },
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
