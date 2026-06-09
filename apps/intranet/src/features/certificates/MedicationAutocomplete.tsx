import type { MedicationResult } from "@finanzas/orpc-contracts/medications";
import { ComboBox, Input, Label, ListBox } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { medicationsORPCClient } from "./medications-orpc";

export interface MedicationAutocompleteProps {
  value: string;
  onChange: (name: string) => void;
  onSelect?: (med: MedicationResult) => void;
  label?: string;
  placeholder?: string;
  isDisabled?: boolean;
}

/**
 * HeroUI v3 ComboBox bound to the medication catalog search endpoint.
 *
 * - Debounced (300 ms) async search; fires after >= 2 chars.
 * - `allowsCustomValue` so the doctor can prescribe a medication not in the
 *   catalog (free text is committed on every keystroke via onChange).
 * - Single render-stable `items[]` array covering every state (placeholder /
 *   loading / empty / results) with globally-unique ids, per React Aria's
 *   ComboBox contract — avoids "Cannot change the id of an item".
 */
export function MedicationAutocomplete({
  value,
  onChange,
  onSelect,
  label = "Medicamento",
  placeholder = "Loratadina, Salbutamol, ...",
  isDisabled = false,
}: Readonly<MedicationAutocompleteProps>) {
  const [inputValue, setInputValue] = useState(value);
  const [debounced, setDebounced] = useState(inputValue);

  // Keep local input in sync when the parent resets/changes the value.
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(inputValue), 300);
    return () => clearTimeout(t);
  }, [inputValue]);

  const term = debounced.trim();

  const { data, isLoading } = useQuery({
    queryKey: ["medications-search", term],
    queryFn: () => medicationsORPCClient.search({ q: term, limit: 15 }),
    enabled: term.length >= 2,
    staleTime: 1000 * 60 * 10,
  });

  const results = useMemo(() => data?.results ?? [], [data]);

  type Row =
    | { kind: "medication"; id: string; label: string; med: MedicationResult }
    | { kind: "placeholder"; id: string; label: string };

  const { items, disabledIds } = useMemo<{ items: Row[]; disabledIds: string[] }>(() => {
    if (term.length < 2) {
      return {
        items: [
          { kind: "placeholder", id: "__too-short__", label: "Escribe al menos 2 caracteres" },
        ],
        disabledIds: ["__too-short__"],
      };
    }
    if (isLoading) {
      return {
        items: [{ kind: "placeholder", id: "__loading__", label: "Buscando…" }],
        disabledIds: ["__loading__"],
      };
    }
    if (results.length === 0) {
      return {
        items: [
          {
            kind: "placeholder",
            id: "__empty__",
            label: "Sin coincidencias — puedes escribir el nombre libremente",
          },
        ],
        disabledIds: ["__empty__"],
      };
    }
    return {
      items: results.map((med) => {
        const detail = [med.genericName, med.presentation, med.form]
          .filter((p): p is string => Boolean(p))
          .join(" · ");
        return {
          kind: "medication" as const,
          id: `med-${med.id}`,
          label: detail ? `${med.name} (${detail})` : med.name,
          med,
        };
      }),
      disabledIds: [],
    };
  }, [term, isLoading, results]);

  return (
    <ComboBox
      allowsCustomValue
      inputValue={inputValue}
      isDisabled={isDisabled}
      items={items}
      menuTrigger="input"
      onInputChange={(next) => {
        setInputValue(next);
        onChange(next);
      }}
      onSelectionChange={(key) => {
        if (key == null) return;
        const row = items.find((i) => i.id === String(key));
        if (row && row.kind === "medication") {
          // Commit the commercial name to the field; surface full record via onSelect.
          setInputValue(row.med.name);
          onChange(row.med.name);
          onSelect?.(row.med);
        }
      }}
    >
      <Label>{label}</Label>
      <ComboBox.InputGroup>
        <Input placeholder={placeholder} />
        <ComboBox.Trigger />
      </ComboBox.InputGroup>
      <ComboBox.Popover>
        <ListBox disabledKeys={disabledIds}>
          {(item: Row) => (
            <ListBox.Item id={item.id} textValue={item.label}>
              {item.label}
            </ListBox.Item>
          )}
        </ListBox>
      </ComboBox.Popover>
    </ComboBox>
  );
}
