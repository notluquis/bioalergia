// Minimal hyperscript for Satori — avoids a React/JSX dependency in this
// build. Satori reads `.type` and `.props` (incl. `style` + `children`) of the
// node tree; this produces exactly that shape. Cast to Satori's ReactNode
// param happens at the render() call site.
export type Style = Record<string, string | number>;

export interface SatoriNode {
  type: string;
  props: {
    style?: Style;
    children?: SatoriChild | SatoriChild[];
    [key: string]: unknown;
  };
}

export type SatoriChild = SatoriNode | string | number | null | undefined | SatoriChild[];

export function h(
  type: string,
  props: { style?: Style; [key: string]: unknown } | null,
  ...children: SatoriChild[]
): SatoriNode {
  const flat = children.flat(Infinity as 1).filter((c) => c !== null && c !== undefined);
  return {
    type,
    props: {
      ...props,
      children: flat.length === 1 ? (flat[0] as SatoriChild) : (flat as SatoriChild[]),
    },
  };
}
