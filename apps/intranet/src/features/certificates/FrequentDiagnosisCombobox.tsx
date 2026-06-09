import { ComboBox, Header, Input, Label, ListBox, Separator } from "@heroui/react";
import type { Key } from "react";
import { Fragment } from "react";

import { FREQUENT_DIAGNOSIS_BY_ID, FREQUENT_DIAGNOSIS_SECTIONS } from "./frequent-diagnoses";

// Atajo de diagnósticos frecuentes — ComboBox HeroUI con secciones (Header no
// seleccionable) agrupando por categoría clínica. Al teclear filtra y mantiene
// los grupos. Seleccionar un item inyecta la consulta en el buscador oficial
// CIE-11 (ECT) → WHO resuelve el código real (no inventamos códigos).

export function FrequentDiagnosisCombobox({ onPick }: { onPick: (query: string) => void }) {
  const handleSelection = (key: Key | null) => {
    if (key == null) return;
    const query = FREQUENT_DIAGNOSIS_BY_ID[String(key)];
    if (query) onPick(query);
  };

  return (
    // selectedKey controlado a null: actúa como menú de acción (elige → dispara
    // → se resetea), reutilizable para varios diagnósticos seguidos.
    <ComboBox className="w-full" onSelectionChange={handleSelection} selectedKey={null}>
      <Label>Diagnósticos frecuentes</Label>
      <ComboBox.InputGroup>
        <Input placeholder="Atajo: rinitis, urticaria, anafilaxia…" />
        <ComboBox.Trigger />
      </ComboBox.InputGroup>
      <ComboBox.Popover>
        <ListBox>
          {FREQUENT_DIAGNOSIS_SECTIONS.map((section, index) => (
            <Fragment key={section.category}>
              {index > 0 ? <Separator /> : null}
              <ListBox.Section>
                <Header>{section.category}</Header>
                {section.items.map((item) => (
                  <ListBox.Item id={item.id} key={item.id} textValue={item.label}>
                    {item.label}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox.Section>
            </Fragment>
          ))}
        </ListBox>
      </ComboBox.Popover>
    </ComboBox>
  );
}
