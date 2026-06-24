import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { z } from "zod";

import { TiendaView } from "@/features/shop/components/TiendaView";
import { sortProducts } from "@/features/shop/lib/catalog";
import { shopKeys } from "@/features/shop/queries";

const sortSchema = z.object({
  sort: z.enum(["relevancia", "precio_asc", "precio_desc"]).optional().default("relevancia"),
});

function TiendaPage() {
  const navigate = Route.useNavigate();
  const { sort } = Route.useSearch();
  const { data, isLoading, error } = useQuery(shopKeys.products());

  const sorted = useMemo(() => (data ? sortProducts(data.data, sort) : []), [data, sort]);

  return (
    <TiendaView
      error={error}
      isLoading={isLoading}
      onSortChange={(next) => {
        void navigate({ search: { sort: next } });
      }}
      productCount={data ? data.data.length : null}
      products={sorted}
      sort={sort}
    />
  );
}

export const Route = createFileRoute("/tienda/")({
  component: TiendaPage,
  validateSearch: sortSchema,
  head: () => {
    const origin = typeof window === "undefined" ? "https://bioalergia.cl" : window.location.origin;
    const url = `${origin}/tienda`;
    return {
      meta: [
        { title: "Tienda · Bioalergia" },
        {
          name: "description",
          content:
            "Productos seleccionados para el cuidado de la piel, hidratación y bienestar. Envío Chilexpress + boleta o factura.",
        },
        { property: "og:title", content: "Tienda · Bioalergia" },
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
});
