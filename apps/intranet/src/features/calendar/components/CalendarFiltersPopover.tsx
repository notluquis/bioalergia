import { Popover } from "@heroui/react";
import { Filter } from "lucide-react";

import Button from "@/components/ui/Button";

import { CalendarFilterPanel, type CalendarFilterPanelProps } from "./CalendarFilterPanel";

interface CalendarFiltersPopoverProps extends CalendarFilterPanelProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  panelWidthClassName?: string;
}

export function CalendarFiltersPopover({
  isOpen,
  onOpenChange,
  panelWidthClassName = "w-[min(92vw,520px)]",
  ...panelProps
}: Readonly<CalendarFiltersPopoverProps>) {
  return (
    <Popover isOpen={isOpen} onOpenChange={onOpenChange}>
      <Popover.Trigger>
        <Button
          className="gap-2"
          size="sm"
          variant={isOpen ? "secondary" : "ghost"}
          color={isOpen ? "primary" : "default"}
        >
          <Filter className="h-4 w-4" />
          <span className="hidden sm:inline">Filtros</span>
        </Button>
      </Popover.Trigger>
      <Popover.Content className="w-80 p-0" offset={8}>
        <div className="bg-content1 rounded-xl shadow-lg ring-1 ring-black/5">
          <div className="border-default-100 flex items-center justify-between border-b px-4 py-3">
            <h3 className="text-small font-semibold">Filtrar Vistas</h3>
          </div>
          <CalendarFilterPanel {...panelProps} variant="plain" />
        </div>
      </Popover.Content>
    </Popover>
  );
}
