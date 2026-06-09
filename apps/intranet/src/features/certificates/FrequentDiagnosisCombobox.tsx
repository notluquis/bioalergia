import { Button, Dropdown, Header, Label } from "@heroui/react";
import { ChevronDown } from "lucide-react";
import type { Key } from "react";

import { FREQUENT_DIAGNOSIS_BY_ID, FREQUENT_DIAGNOSIS_SECTIONS } from "./frequent-diagnoses";

// Atajo de diagnósticos frecuentes — Dropdown (menú de acciones) agrupado por
// sección con Header no seleccionable. Es un menú, NO un select: al elegir un
// item dispara la búsqueda oficial CIE-11 (seteando el query) y SE CIERRA solo
// (onAction). WHO resuelve el código real (no inventamos códigos).

export function FrequentDiagnosisCombobox({ onPick }: { onPick: (query: string) => void }) {
  const handleAction = (key: Key) => {
    const query = FREQUENT_DIAGNOSIS_BY_ID[String(key)];
    if (query) onPick(query);
  };

  return (
    <div className="space-y-1">
      <Label>Diagnósticos frecuentes</Label>
      <Dropdown>
        <Button className="w-full justify-between" variant="outline">
          Atajo: rinitis, urticaria, anafilaxia…
          <ChevronDown size={16} />
        </Button>
        <Dropdown.Popover className="max-h-80 w-[var(--trigger-width)] overflow-y-auto">
          <Dropdown.Menu onAction={handleAction}>
            {FREQUENT_DIAGNOSIS_SECTIONS.map((section) => (
              <Dropdown.Section key={section.category}>
                <Header>{section.category}</Header>
                {section.items.map((item) => (
                  <Dropdown.Item id={item.id} key={item.id} textValue={item.label}>
                    <Label>{item.label}</Label>
                  </Dropdown.Item>
                ))}
              </Dropdown.Section>
            ))}
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
    </div>
  );
}
