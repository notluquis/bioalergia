import { Checkbox, Label } from "@heroui/react";
import { Check, Loader2, Minus } from "lucide-react";

interface RolePermissionCheckboxProps {
  ariaLabel: string;
  isDisabled?: boolean;
  isIndeterminate?: boolean;
  isSelected: boolean;
  isUpdating?: boolean;
  onChange: () => void;
}

export function RolePermissionCheckbox({
  ariaLabel,
  isDisabled = false,
  isIndeterminate = false,
  isSelected,
  isUpdating = false,
  onChange,
}: RolePermissionCheckboxProps) {
  return (
    <Checkbox
      aria-label={ariaLabel}
      className="justify-center"
      isDisabled={isDisabled}
      isIndeterminate={isIndeterminate}
      isSelected={isSelected}
      onChange={onChange}
      variant="secondary"
    >
      <Checkbox.Control className="border border-default-300/70 bg-default-200/50 shadow-none transition-colors data-[disabled=true]:border-default-300/60 data-[disabled=true]:bg-default-200/35 data-[selected=true]:border-transparent data-[selected=true]:bg-accent data-[indeterminate=true]:border-transparent data-[indeterminate=true]:bg-accent">
        {isUpdating ? (
          <Loader2 className="animate-spin text-default-500 size-3.5" />
        ) : (
          <Checkbox.Indicator>
            {({ isIndeterminate: indeterminate, isSelected: selected }) => {
              if (indeterminate) {
                return <Minus className="size-3.5" strokeWidth={3} />;
              }
              return selected ? <Check className="size-3.5" /> : null;
            }}
          </Checkbox.Indicator>
        )}
      </Checkbox.Control>
      <Checkbox.Content className="sr-only">
        <Label>{ariaLabel}</Label>
      </Checkbox.Content>
    </Checkbox>
  );
}
