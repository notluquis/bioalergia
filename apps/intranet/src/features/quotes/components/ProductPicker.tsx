import { Autocomplete, EmptyState, ListBox, SearchField, Spinner, useFilter } from "@heroui/react";
import type { QuoteProductDto } from "@finanzas/orpc-contracts/quotes";
import { useQuery } from "@tanstack/react-query";
import type { Key } from "react";
import { useState } from "react";
import { listQuoteProducts, quotesKeys } from "@/features/quotes/api";
import { formatCurrency } from "@/lib/utils";

const EMPTY: QuoteProductDto[] = [];

type ProductPickerProps = {
  onSelect: (product: QuoteProductDto) => void;
};

/** Picker de catálogo: agrega una línea a la cotización al seleccionar. */
export function ProductPicker({ onSelect }: ProductPickerProps) {
  const { contains } = useFilter({ sensitivity: "base" });
  const productsQuery = useQuery({
    queryKey: quotesKeys.products(),
    queryFn: listQuoteProducts,
  });
  const products = (productsQuery.data ?? EMPTY).filter((p) => p.isActive);
  const [pickerKey, setPickerKey] = useState(0);

  if (productsQuery.isLoading) {
    return <Spinner aria-label="Cargando productos" />;
  }

  return (
    <Autocomplete
      aria-label="Agregar producto"
      className="w-full"
      key={pickerKey}
      selectionMode="single"
      value={null}
      onChange={(k: Key | Key[] | null) => {
        const key = Array.isArray(k) ? k[0] : k;
        const picked = products.find((p) => String(p.id) === String(key));
        if (picked) {
          onSelect(picked);
          setPickerKey((n) => n + 1);
        }
      }}
      placeholder="Buscar y agregar producto…"
    >
      <Autocomplete.Trigger>
        <Autocomplete.Value />
        <Autocomplete.ClearButton />
        <Autocomplete.Indicator />
      </Autocomplete.Trigger>
      <Autocomplete.Popover>
        <Autocomplete.Filter filter={contains}>
          <SearchField name="search" variant="secondary">
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input placeholder="Marca, categoría, código o detalle…" />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
          <ListBox renderEmptyState={() => <EmptyState>Sin productos</EmptyState>}>
            {products.map((p) => (
              <ListBox.Item
                id={String(p.id)}
                key={p.id}
                textValue={`${p.code ?? ""} ${p.brand ?? ""} ${p.category ?? ""} ${p.name} ${p.format ?? ""}`}
              >
                <span className="font-medium">{p.name}</span>
                {p.format ? <span className="text-default-500"> · {p.format}</span> : null}
                {p.brand || p.category ? (
                  <span className="text-default-500">
                    {" "}
                    — {[p.brand, p.category].filter(Boolean).join(" · ")}
                  </span>
                ) : null}
                <span className="text-default-500"> · {formatCurrency(p.unitPrice)}</span>
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Autocomplete.Filter>
      </Autocomplete.Popover>
    </Autocomplete>
  );
}
