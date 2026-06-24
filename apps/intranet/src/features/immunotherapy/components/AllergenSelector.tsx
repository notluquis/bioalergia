import type { Key } from "@heroui/react";
import { Autocomplete, Chip, EmptyState, ListBox, SearchField, useFilter } from "@heroui/react";
import { Search, X } from "lucide-react";
import { useState } from "react";
import { ALLERGENS_DB, getAllergenById } from "../data/allergens_db";
import type { Allergen, AllergenFamily } from "../data/types";
import { FAMILY_CHIP_COLORS, FAMILY_LABELS } from "../data/types";

interface AllergenSelectorProps {
  selectedIds: string[];
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
}

/** Orden de renderizado de familias en el dropdown */
const FAMILY_ORDER: AllergenFamily[] = [
  "acaros",
  "gramineas",
  "arboles",
  "malezas",
  "epitelios",
  "hongos",
];

export function AllergenSelector({ selectedIds, onAdd, onRemove }: AllergenSelectorProps) {
  const { contains } = useFilter({ sensitivity: "base" });
  const [pickerKey, setPickerKey] = useState(0);

  const availableAllergens = ALLERGENS_DB.filter((a) => !selectedIds.includes(a.id));
  const selectedAllergens = selectedIds
    .map(getAllergenById)
    .filter((a): a is Allergen => a != null);

  // Group available allergens by family
  const grouped = FAMILY_ORDER.map((family) => ({
    family,
    label: FAMILY_LABELS[family],
    allergens: availableAllergens.filter((a) => a.family === family),
  })).filter((g) => g.allergens.length > 0);

  const handleSelect = (key: Key | Key[] | null) => {
    if (key == null) return;
    const id = Array.isArray(key) ? String(key[0]) : String(key);
    if (id && !selectedIds.includes(id)) {
      onAdd(id);
      setPickerKey((k) => k + 1);
    }
  };

  return (
    <div className="space-y-3">
      {/* ── Autocomplete Picker ─────────────────────────────────────────── */}
      <Autocomplete
        key={pickerKey}
        aria-label="Buscar alérgeno"
        className="w-full"
        selectionMode="single"
        value={null}
        onChange={handleSelect}
        placeholder="Escribe para buscar un alérgeno…"
        isDisabled={availableAllergens.length === 0}
      >
        <Autocomplete.Trigger>
          <Autocomplete.Value />
          <Autocomplete.ClearButton />
          <Autocomplete.Indicator />
        </Autocomplete.Trigger>
        <Autocomplete.Popover>
          <Autocomplete.Filter filter={contains}>
            <SearchField name="allergen-search" variant="secondary">
              <SearchField.Group>
                <SearchField.SearchIcon>
                  <Search size={16} />
                </SearchField.SearchIcon>
                <SearchField.Input placeholder="Buscar por nombre o familia…" />
                <SearchField.ClearButton />
              </SearchField.Group>
            </SearchField>
            <ListBox renderEmptyState={() => <EmptyState>No se encontraron alérgenos</EmptyState>}>
              {grouped.flatMap((group) => [
                <ListBox.Item
                  key={`header-${group.family}`}
                  id={`header-${group.family}`}
                  textValue={group.label}
                  className="pointer-events-none font-semibold text-default-500 text-xs uppercase tracking-wider"
                >
                  {group.label}
                </ListBox.Item>,
                ...group.allergens.map((allergen) => (
                  <ListBox.Item
                    id={allergen.id}
                    key={allergen.id}
                    textValue={`${allergen.name} ${allergen.scientificName} ${FAMILY_LABELS[allergen.family]}`}
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium text-sm">{allergen.name}</span>
                      <span className="text-default-400 text-xs italic">
                        {allergen.scientificName} · {allergen.molecularMarker}
                      </span>
                    </div>
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                )),
              ])}
            </ListBox>
          </Autocomplete.Filter>
        </Autocomplete.Popover>
      </Autocomplete>

      {/* ── Selected Allergens (Chips) ──────────────────────────────────── */}
      {selectedAllergens.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedAllergens.map((a, idx) => (
            <div
              key={a.id}
              className="animate-in fade-in zoom-in-95 fill-mode-both"
              style={{
                animationDelay: `${idx * 50}ms`,
                animationDuration: "200ms",
              }}
            >
              <Chip color={FAMILY_CHIP_COLORS[a.family]} size="sm" variant="soft">
                <span className="flex items-center gap-1.5">
                  <span>{a.name}</span>
                  <button
                    type="button"
                    onClick={() => onRemove(a.id)}
                    className="rounded-full p-0.5 opacity-60 transition-opacity hover:opacity-100"
                    aria-label={`Quitar ${a.name}`}
                  >
                    <X size={10} />
                  </button>
                </span>
              </Chip>
            </div>
          ))}
        </div>
      )}

      {/* ── Counter ─────────────────────────────────────────────────────── */}
      {selectedAllergens.length > 0 && (
        <p className="text-default-400 text-xs">
          {selectedAllergens.length} de {ALLERGENS_DB.length} alérgenos seleccionados
        </p>
      )}
    </div>
  );
}
