import { Button, Popover } from "@heroui/react";
import { Filter } from "lucide-react";

import { cn } from "@/lib/utils";

import { CalendarFilterPanel, type CalendarFilterPanelProps } from "./CalendarFilterPanel";

interface CalendarFiltersPopoverProps extends CalendarFilterPanelProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  panelWidthClassName?: string;
}

export function CalendarFiltersPopover({
  isOpen,
  onOpenChange,
  panelWidthClassName = "w-[min(92vw,460px)]",
  ...panelProps
}: Readonly<CalendarFiltersPopoverProps>) {
  return (
    <Popover isOpen={isOpen} onOpenChange={onOpenChange}>
      <Popover.Trigger>
        <Button className="gap-2" size="sm" variant={isOpen ? "secondary" : "ghost"}>
          <Filter className="h-4 w-4" />
          <span className="hidden sm:inline">Filtros</span>
        </Button>
      </Popover.Trigger>
      <Popover.Content className={cn(panelWidthClassName, "p-0")} offset={6}>
        <div className="rounded-xl bg-content1 shadow-lg ring-1 ring-black/5">
          <div className="flex items-center justify-between border-default-100 border-b px-3 py-2.5">
            <h3 className="font-semibold text-small">Filtrar Vistas</h3>
          </div>
          <CalendarFilterPanel {...panelProps} variant="plain" />
        </div>
      </Popover.Content>
    </Popover>
  );
}
