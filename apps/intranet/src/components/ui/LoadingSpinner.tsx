import { Spinner } from "@heroui/react";
import type { ComponentProps } from "react";

type SpinnerProps = ComponentProps<typeof Spinner>;

interface LoadingSpinnerProps extends Omit<SpinnerProps, "aria-label"> {
  /** Visible-to-screen-readers description (sr-only text). Defaults to "Cargando". */
  label?: string;
}

/**
 * HeroUI v3 Spinner renders a `<span class="spinner">` with no role.
 * Passing `aria-label` directly to <Spinner /> trips axe rule
 * `aria-prohibited-attr` (serious) because aria-label on a generic span
 * with no role is forbidden under ARIA 1.2.
 *
 * The W3C WAI-ARIA Authoring Practices recommend wrapping the spinner in
 * a live region (`role="status"`) and putting the label in sr-only text
 * so screen readers announce it without polluting the visual UI.
 *
 * Use this in place of <Spinner aria-label="..."> everywhere.
 */
export function LoadingSpinner({ label = "Cargando", ...rest }: LoadingSpinnerProps) {
  return (
    <div role="status" aria-live="polite">
      <Spinner {...rest} />
      <span className="sr-only">{label}</span>
    </div>
  );
}
