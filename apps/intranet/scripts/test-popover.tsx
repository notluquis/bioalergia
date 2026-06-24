import React, { useRef } from "react";
import { Popover, PopoverContent, PopoverDialog } from "@heroui/react";

export function Test() {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div>
      <div ref={ref}>Trigger</div>
      <Popover triggerRef={ref} isOpen={true}>
        <Popover.Content>
          <Popover.Dialog>Hello</Popover.Dialog>
        </Popover.Content>
      </Popover>
    </div>
  );
}
