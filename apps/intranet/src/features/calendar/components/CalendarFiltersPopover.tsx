import { Popover } from "@heroui/react";
import { Filter } from "lucide-react";

import Button from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

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
        <Button className="gap-1.5" size="sm" variant={isOpen ? "secondary" : "ghost"}>
          <Filter className="h-4 w-4" />
          <span className="hidden sm:inline">{isOpen ? "Cerrar" : "Filtros"}</span>
        </Button>
      </Popover.Trigger>
      <Popover.Content className="z-50 max-h-[80svh] overflow-y-auto p-0" offset={8}>
        <Popover.Dialog className="p-0">
          <div className={panelWidthClassName}>
            <Card className="rounded-xl border border-default-200/70 bg-content1/90 shadow-lg backdrop-blur">
              <CalendarFilterPanel {...panelProps} variant="plain" />
            </Card>
          </div>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}
