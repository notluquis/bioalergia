import type { ElementType, ReactNode } from "react";

import { Container } from "@/components/ui/Container";

/**
 * Full-width section band — edge-to-edge background colour with the editorial
 * container inside. The home + content pages are a vertical stack of these.
 *
 * Tones map to the handoff's alternating rhythm (neutral → surface → cool
 * neutral) plus the deep-blue anchor band used for founder / closing / footer.
 */
export type BandTone = "bg" | "surface" | "surface2" | "deep";

const toneClass: Record<BandTone, string> = {
  bg: "bg-background text-foreground",
  surface: "bg-surface text-surface-foreground",
  surface2: "bg-surface-2 text-foreground",
  // Deep anchor band — fixed brand deep-blue in both themes, light text.
  deep: "bg-brand-blue-deep text-[#eef3f9]",
};

export function SectionBand({
  tone = "bg",
  borderTop = false,
  borderBottom = false,
  className = "",
  innerClassName = "",
  as: As = "section",
  id,
  children,
}: {
  tone?: BandTone;
  borderTop?: boolean;
  borderBottom?: boolean;
  className?: string;
  innerClassName?: string;
  as?: ElementType;
  id?: string;
  children: ReactNode;
}) {
  const borders = [
    borderTop ? "border-t border-line" : "",
    borderBottom ? "border-b border-line" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <As className={`${toneClass[tone]} ${borders} ${className}`} id={id}>
      <Container className={`py-16 sm:py-20 lg:py-[5.75rem] ${innerClassName}`}>
        {children}
      </Container>
    </As>
  );
}
