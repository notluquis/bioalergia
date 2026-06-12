import { Alert, Label, ListBox, Radio, RadioGroup, Select } from "@heroui/react";
import { Info, Layers, Split } from "lucide-react";
import { getAllergenById } from "../data/allergens_db";
import type { Allergen, ClinicalRelevanceMode } from "../data/types";

interface RelevanceSelectorProps {
  /** IDs de los alérgenos no-proteolíticos (sin Alternaria) */
  allergenIds: string[];
  /** Modo de relevancia seleccionado */
  relevanceMode: ClinicalRelevanceMode | undefined;
  /** ID del alérgeno dominante */
  dominantAllergenId: string | undefined;
  /** Callback cuando cambia el modo */
  onRelevanceModeChange: (mode: ClinicalRelevanceMode) => void;
  /** Callback cuando cambia el dominante */
  onDominantChange: (id: string | undefined) => void;
}

export function RelevanceSelector({
  allergenIds,
  relevanceMode,
  dominantAllergenId,
  onRelevanceModeChange,
  onDominantChange,
}: RelevanceSelectorProps) {
  const allergens = allergenIds.map(getAllergenById).filter((a): a is Allergen => a != null);

  const needsDominantPicker =
    relevanceMode === "dominant_split" || relevanceMode === "dominant_max";

  return (
    <div
      className="animate-in fade-in slide-in-from-top-2 fill-mode-both space-y-4"
      style={{ animationDuration: "400ms" }}
    >
      {/* ── Nota informativa ────────────────────────────────────────────── */}
      <Alert status="default">
        <Alert.Indicator>
          <Info size={16} />
        </Alert.Indicator>
        <Alert.Content>
          <Alert.Description>
            Ha seleccionado {allergenIds.length} alérgenos. Indique la relevancia clínica para
            determinar la formulación óptima. Las formulaciones MAX FORTE (asimétricas 30k/10k) no
            están disponibles en Chile.
          </Alert.Description>
        </Alert.Content>
      </Alert>

      {/* ── RadioGroup: 3 opciones ──────────────────────────────────────── */}
      <RadioGroup
        value={relevanceMode ?? ""}
        onChange={(value) => onRelevanceModeChange(value as ClinicalRelevanceMode)}
      >
        <Label className="mb-2 font-medium text-sm">Relevancia clínica</Label>

        <div className="grid gap-2 sm:grid-cols-3">
          {/* Opción 1: Simétrico → MAX */}
          <Radio
            value="equal"
            className="cursor-pointer rounded-2xl border border-default-200 p-4 transition-all data-[selected=true]:border-primary data-[selected=true]:bg-primary/5"
          >
            <Radio.Control>
              <Radio.Indicator />
            </Radio.Control>
            <Radio.Content>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5">
                  <Layers size={14} className="text-primary" />
                  <Label className="font-semibold text-sm">Igual severidad</Label>
                </div>
                <span className="text-default-500 text-xs">
                  Formulación MAX simétrica. Todos los alérgenos al 100% de su dosis terapéutica en
                  un solo frasco.
                </span>
              </div>
            </Radio.Content>
          </Radio>

          {/* Opción 2: Dominante → Separar */}
          <Radio
            value="dominant_split"
            className="cursor-pointer rounded-2xl border border-default-200 p-4 transition-all data-[selected=true]:border-warning data-[selected=true]:bg-warning/5"
          >
            <Radio.Control>
              <Radio.Indicator />
            </Radio.Control>
            <Radio.Content>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5">
                  <Split size={14} className="text-warning" />
                  <Label className="font-semibold text-sm">Dominante → Separar</Label>
                </div>
                <span className="text-default-500 text-xs">
                  Separar en frascos independientes para dosificación manual asimétrica del alérgeno
                  principal.
                </span>
              </div>
            </Radio.Content>
          </Radio>

          {/* Opción 3: Dominante → MAX simétrico */}
          <Radio
            value="dominant_max"
            className="cursor-pointer rounded-2xl border border-default-200 p-4 transition-all data-[selected=true]:border-secondary data-[selected=true]:bg-secondary/5"
          >
            <Radio.Control>
              <Radio.Indicator />
            </Radio.Control>
            <Radio.Content>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5">
                  <Layers size={14} className="text-secondary" />
                  <Label className="font-semibold text-sm">Dominante → MAX</Label>
                </div>
                <span className="text-default-500 text-xs">
                  Usar MAX simétrico igualmente. Ambos alérgenos al 100%, aceptando no diferenciar
                  la dosis del dominante.
                </span>
              </div>
            </Radio.Content>
          </Radio>
        </div>
      </RadioGroup>

      {/* ── Selector de alérgeno dominante ──────────────────────────────── */}
      {needsDominantPicker && (
        <div
          className="animate-in fade-in slide-in-from-top-1 max-w-xs fill-mode-both"
          style={{ animationDuration: "300ms" }}
        >
          <Select
            aria-label="Alérgeno dominante"
            selectedKey={dominantAllergenId ?? ""}
            onSelectionChange={(k) => onDominantChange(k ? String(k) : undefined)}
          >
            <Label>¿Cuál es el alérgeno dominante?</Label>
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {allergens.map((a) => (
                  <ListBox.Item id={a.id} key={a.id} textValue={a.name}>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm">{a.name}</span>
                      <span className="text-default-400 text-xs italic">{a.scientificName}</span>
                    </div>
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
        </div>
      )}
    </div>
  );
}
