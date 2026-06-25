/**
 * Brand button/link class helper (handoff button system). One primary (amber)
 * action per zone; blue = secondary; outline/link = tertiary; whatsapp = green
 * with a status dot. Apply to HeroUI `Button` (onPress) or `Link` (href).
 *
 *   <Button className={ctaClass("primary")} onPress={book}>Reservar</Button>
 *   <Link className={ctaClass("outline")} href="/tienda">Ir a la tienda</Link>
 */
export type CtaVariant = "primary" | "secondary" | "outline" | "link" | "whatsapp";

const base =
  "inline-flex items-center justify-center gap-2 font-bold no-underline transition-[filter,background-color,color] disabled:opacity-60";

const variants: Record<CtaVariant, string> = {
  primary: `${base} rounded-[3px] bg-brand-amber px-6 py-3 text-[0.97rem] text-brand-amber-ink hover:brightness-[1.04]`,
  secondary: `${base} rounded-[3px] bg-brand-blue px-6 py-3 text-[0.97rem] text-white hover:brightness-[1.06]`,
  outline: `${base} rounded-[3px] border-[1.5px] border-brand-blue px-[1.4rem] py-[0.7rem] text-[0.97rem] text-brand-blue hover:bg-brand-blue/5`,
  link: "inline-flex items-center gap-2 font-semibold text-brand-blue no-underline hover:underline underline-offset-4",
  whatsapp:
    "inline-flex items-center gap-2 font-semibold text-doctoralia-green no-underline hover:underline underline-offset-4",
};

export function ctaClass(variant: CtaVariant, extra = ""): string {
  return `${variants[variant]} ${extra}`.trim();
}
