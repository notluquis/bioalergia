import { Autocomplete, EmptyState, ListBox, SearchField, Spinner, useFilter } from "@heroui/react";
import type { CompanyDto } from "@finanzas/orpc-contracts/quotes";
import { useQuery } from "@tanstack/react-query";
import type { Key } from "react";
import { useState } from "react";
import { listCompanies, quotesKeys } from "@/features/quotes/api";

const EMPTY: CompanyDto[] = [];

type CompanyPickerProps = {
  onSelect: (company: CompanyDto) => void;
  placeholder?: string;
};

/**
 * "Pulpo de companies" — selector de empresa por composición HeroUI
 * (Autocomplete + SearchField + ListBox). Espeja el picker de alérgenos.
 * Dispara `onSelect` y se resetea para permitir nuevas búsquedas.
 */
export function CompanyPicker({ onSelect, placeholder }: CompanyPickerProps) {
  const { contains } = useFilter({ sensitivity: "base" });
  const companiesQuery = useQuery({
    queryKey: quotesKeys.companies(),
    queryFn: () => listCompanies(),
  });
  const companies = companiesQuery.data ?? EMPTY;
  const [pickerKey, setPickerKey] = useState(0);

  if (companiesQuery.isLoading) {
    return <Spinner aria-label="Cargando empresas" />;
  }

  return (
    <Autocomplete
      aria-label="Buscar empresa"
      className="w-full"
      key={pickerKey}
      selectionMode="single"
      value={null}
      onChange={(k: Key | Key[] | null) => {
        const key = Array.isArray(k) ? k[0] : k;
        const picked = companies.find((c) => String(c.id) === String(key));
        if (picked) {
          onSelect(picked);
          setPickerKey((n) => n + 1);
        }
      }}
      placeholder={placeholder ?? "Buscar empresa por razón social o RUT…"}
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
              <SearchField.Input placeholder="Escribe para buscar…" />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
          <ListBox renderEmptyState={() => <EmptyState>Sin empresas</EmptyState>}>
            {companies.map((c) => (
              <ListBox.Item
                id={String(c.id)}
                key={c.id}
                textValue={`${c.razonSocial} ${c.rut ?? ""}`}
              >
                {c.razonSocial}
                {c.rut ? ` · ${c.rut}` : ""}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Autocomplete.Filter>
      </Autocomplete.Popover>
    </Autocomplete>
  );
}
