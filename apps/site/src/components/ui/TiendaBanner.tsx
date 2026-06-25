/**
 * Promo banner — full-width amber strip driving to the storefront. Sits above
 * the sticky header (scrolls away). Restored from the pre-redesign home.
 */
export function TiendaBanner() {
  return (
    <a
      className="flex items-center justify-center gap-2 bg-brand-amber px-4 py-2 text-center font-semibold text-[0.85rem] text-brand-amber-ink no-underline transition hover:brightness-[1.04]"
      href="/tienda"
    >
      <span aria-hidden="true">🛍</span>
      <span>Visita nuestra tienda</span>
      <span className="hidden opacity-80 sm:inline">
        — botiquín y productos seleccionados, envío a todo Chile vía Chilexpress →
      </span>
    </a>
  );
}
