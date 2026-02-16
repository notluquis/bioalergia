import { Chip, ScrollShadow } from "@heroui/react";
import { Button } from "@/components/ui/Button";

import type { Counterpart, CounterpartCategory } from "../types";

interface CounterpartListProps {
  className?: string;
  counterparts: Counterpart[];
  emptyMessage?: string;
  isCollapsed?: boolean;
  onSelectCounterpart: (id: null | number) => void;
  selectedId: null | number;
}

const CATEGORY_OPTIONS: { label: string; value: CounterpartCategory }[] = [
  { label: "Proveedor", value: "SUPPLIER" },
  { label: "Cliente", value: "CLIENT" },
  { label: "Empleado", value: "EMPLOYEE" },
  { label: "Socio", value: "PARTNER" },
  { label: "Prestamista", value: "LENDER" },
  { label: "Gasto personal (socios)", value: "PERSONAL_EXPENSE" },
  { label: "Otro", value: "OTHER" },
];

const CATEGORY_LABELS = CATEGORY_OPTIONS.reduce<Record<string, string>>((acc, item) => {
  acc[item.value] = item.label;
  return acc;
}, {});
export function CounterpartList({
  className,
  counterparts,
  emptyMessage = "No hay registros aún.",
  isCollapsed = false,
  onSelectCounterpart,
  selectedId,
}: CounterpartListProps) {
  if (isCollapsed) {
    return (
      <aside className={`flex h-full min-h-0 flex-col overflow-hidden ${className ?? ""}`}>
        <div className="flex flex-1 items-center justify-center rounded-2xl border border-default-200/70 border-dashed bg-default-50/30 px-4 py-6 text-center text-default-500 text-sm">
          Listado oculto
        </div>
      </aside>
    );
  }

  return (
    <aside className={`flex h-full min-h-0 flex-col overflow-hidden ${className ?? ""}`}>
      <ScrollShadow className="min-h-0 flex-1 pr-1">
        <ul className="space-y-2">
          {counterparts.map((item) => {
            const isActive = selectedId === item.id;
            return (
              <li key={item.id}>
                <Button
                  className={`group w-full cursor-pointer rounded-2xl border px-3 py-2 text-left transition-all ${
                    isActive
                      ? "border-primary/45 bg-primary/10 shadow-sm"
                      : "border-default-200/70 bg-default-50/60 hover:border-default-300 hover:bg-default-100/60"
                  }`}
                  onPress={() => {
                    onSelectCounterpart(item.id);
                  }}
                  type="button"
                  variant="ghost"
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className="block font-medium text-foreground tracking-tight">
                      {item.bankAccountHolder}
                    </span>
                    <Chip size="sm" variant={isActive ? "secondary" : "soft"}>
                      {CATEGORY_LABELS[item.category] ?? item.category}
                    </Chip>
                  </span>
                  {item.identificationNumber && (
                    <span className="mt-1 block text-default-600 text-xs">
                      RUT {item.identificationNumber}
                    </span>
                  )}
                </Button>
              </li>
            );
          })}
          {counterparts.length === 0 && (
            <li className="rounded-xl border border-default-300 border-dashed bg-default-50 px-3 py-3 text-center text-default-500 text-sm">
              {emptyMessage}
            </li>
          )}
        </ul>
      </ScrollShadow>
    </aside>
  );
}
