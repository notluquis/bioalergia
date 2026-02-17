import { Button, FieldError, Label, ListBox, Modal, Select } from "@heroui/react";
import type { ReactNode } from "react";
import { useState } from "react";
import { z } from "zod";

interface SelectWithCreateNewProps {
  label: string;
  options: Array<{ id: string; label: string }>;
  value: string | null;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  createSchema: z.ZodSchema;
  onCreateNew: (value: string) => void;
  errors?: string[];
  isRequired?: boolean;
  createButtonLabel?: string;
  description?: ReactNode;
  isDisabled?: boolean;
}

export function SelectWithCreateNew({
  createButtonLabel = "+ Nueva opción",
  createSchema,
  description,
  errors = [],
  isDisabled = false,
  isRequired = false,
  label,
  onChange,
  onBlur,
  onCreateNew,
  options,
  placeholder = "Selecciona...",
  value,
}: SelectWithCreateNewProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newValue, setNewValue] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateNew = async () => {
    setCreateError(null);

    try {
      const validated = createSchema.parse(newValue) as string;
      setIsCreating(true);

      onCreateNew(validated);
      onChange(validated);

      setNewValue("");
      setIsCreateOpen(false);
    } catch (error) {
      if (error instanceof z.ZodError) {
        setCreateError(error.issues[0]?.message || "Error de validación");
      } else {
        setCreateError("Error al crear la opción");
      }
    } finally {
      setIsCreating(false);
    }
  };

  const selectedOption = options.find((opt) => opt.id === value);

  return (
    <div className="space-y-2">
      <Select
        isDisabled={isDisabled}
        isRequired={isRequired}
        onSelectionChange={(key) => {
          if (key) {
            onChange(String(key));
            onBlur?.();
          }
        }}
        onBlur={onBlur}
        placeholder={placeholder}
        selectedKey={value || undefined}
      >
        <Label>{label}</Label>
        <Select.Trigger>
          <Select.Value>{selectedOption?.label || placeholder}</Select.Value>
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {options.map((option) => (
              <ListBox.Item id={option.id} key={option.id} textValue={option.label}>
                {option.label}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
        {errors.length > 0 && <FieldError>{errors.join(", ")}</FieldError>}
      </Select>

      {description && <p className="text-default-500 text-xs">{description}</p>}

      <Button
        isDisabled={isDisabled}
        onPress={() => setIsCreateOpen(true)}
        size="sm"
        variant="ghost"
      >
        {createButtonLabel}
      </Button>

      <Modal isOpen={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <Modal.Backdrop />
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-sm">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>Nueva {label.toLowerCase()}</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="gap-4">
              <div className="space-y-2">
                <Label>{label}</Label>
                <input
                  className="w-full rounded-md border border-default-200 bg-default-50 px-3 py-2 text-foreground text-sm transition hover:border-default-300 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  onChange={(e) => {
                    setNewValue(e.target.value);
                    setCreateError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !isCreating) {
                      void handleCreateNew();
                    }
                  }}
                  placeholder={`Ej: ${label}`}
                  type="text"
                  value={newValue}
                  disabled={isCreating}
                />
                {createError && <FieldError>{createError}</FieldError>}
              </div>
            </Modal.Body>
            <Modal.Footer className="gap-2">
              <Button
                isDisabled={isCreating}
                onPress={() => setIsCreateOpen(false)}
                variant="secondary"
              >
                Cancelar
              </Button>
              <Button isDisabled={isCreating || !newValue.trim()} onPress={handleCreateNew}>
                {isCreating ? "Creando..." : "Crear"}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal>
    </div>
  );
}
