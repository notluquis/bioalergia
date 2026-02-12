import type { ReactNode } from "react";

export function ServicesSurface({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  // TODO(heroui-v3): replace remaining ServicesSurface usages (outside counterparts)
  // with HeroUI v3 Beta primitives from MCP docs (e.g. Card/Section + spacing tokens).
  return (
    <section className={`surface-recessed rounded-[28px] p-6 shadow-inner ${className}`}>
      <div className="space-y-6">{children}</div>
    </section>
  );
}
