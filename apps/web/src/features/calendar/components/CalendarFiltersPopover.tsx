import { PopoverContent, PopoverRoot, PopoverTrigger } from "@heroui/react";
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
    <PopoverRoot isOpen={isOpen} onOpenChange={onOpenChange}>
      <PopoverTrigger>
        <Button className="gap-1.5" size="sm" variant={isOpen ? "secondary" : "ghost"}>
          <Filter className="h-4 w-4" />
          <span className="hidden sm:inline">{isOpen ? "Cerrar" : "Filtros"}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="z-50 max-h-[80svh] overflow-y-auto p-0"
        isNonModal
        offset={8}
        placement="bottom"
      >
        <div className={panelWidthClassName}>
          <CalendarFilterPanel {...panelProps} />
        </div>
      </PopoverContent>
    </PopoverRoot>
  );
}
