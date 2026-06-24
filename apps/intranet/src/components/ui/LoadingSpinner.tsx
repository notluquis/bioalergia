import { Spinner as HeroUISpinner } from "@heroui/react";
import type { ComponentProps } from "react";

type HeroUISpinnerProps = ComponentProps<typeof HeroUISpinner>;

interface LoadingSpinnerProps extends Omit<HeroUISpinnerProps, "aria-label"> {
  /** sr-only label announced by screen readers. Defaults to "Cargando". */
  label?: string;
}

/**
 * Thin wrapper around HeroUI v3 `<Spinner />` that adds the ARIA scaffolding
 * the upstream component is missing. The HeroUI v3 Spinner public API only
 * exposes `size`, `color`, `className` (verified via heroui.com/docs/react/
 * components/spinner) — there's no slot, no role/aria-label prop, no render
 * prop. Forwarding `aria-label` directly to the component lands on a
 * `<span class="spinner">` with no role, which axe 4.11
 * `aria-prohibited-attr` correctly flags as a serious violation.
 *
 * Per the W3C WAI-ARIA Authoring Practices for loading indicators we wrap
 * the HeroUI Spinner in a `role="status" aria-live="polite"` region and
 * place the description in sr-only text. Visuals are unchanged — under the
 * hood it's still the HeroUI Spinner.
 */
export function LoadingSpinner({ label = "Cargando", ...rest }: LoadingSpinnerProps) {
  return (
    <output aria-live="polite">
      <HeroUISpinner {...rest} />
      <span className="sr-only">{label}</span>
    </output>
  );
}
