/**
 * Molecular network motif from the logo — blue + amber nodes, decorative.
 * Subtle identity thread; never the protagonist. Always `aria-hidden`.
 */
export function MoleculeMotif({
  className = "",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg aria-hidden="true" className={className} fill="none" style={style} viewBox="0 0 400 400">
      <g stroke="currentColor" strokeWidth="1.5">
        <line x1="80" y1="120" x2="170" y2="90" />
        <line x1="170" y1="90" x2="240" y2="150" />
        <line x1="240" y1="150" x2="190" y2="230" />
        <line x1="190" y1="230" x2="100" y2="210" />
        <line x1="100" y1="210" x2="80" y2="120" />
        <line x1="240" y1="150" x2="320" y2="110" />
        <line x1="190" y1="230" x2="280" y2="270" />
      </g>
      <circle cx="80" cy="120" r="9" fill="var(--brand-blue)" />
      <circle cx="170" cy="90" r="7" fill="var(--brand-amber)" />
      <circle cx="240" cy="150" r="11" fill="var(--brand-blue)" />
      <circle cx="190" cy="230" r="8" fill="var(--brand-amber)" />
      <circle cx="100" cy="210" r="6" fill="var(--brand-blue)" />
      <circle cx="320" cy="110" r="7" fill="var(--brand-amber)" />
      <circle cx="280" cy="270" r="6" fill="var(--brand-blue)" />
    </svg>
  );
}
