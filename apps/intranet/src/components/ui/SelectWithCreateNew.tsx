import { Button, FieldError, Input, Label, ListBox, Modal, Select, TextField } from "@heroui/react";
import type { ChangeEvent, KeyboardEvent, ReactNode } from "react";
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
        onChange={(key) => {
          if (key) {
            onChange(String(key));
            onBlur?.();
          }
        }}
        onBlur={onBlur}
        placeholder={placeholder}
        value={value || null}
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

      <Modal>
        <Modal.Backdrop isOpen={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <Modal.Container>
            <Modal.Dialog className="sm:max-w-sm">
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>Nueva {label.toLowerCase()}</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="gap-4">
                <TextField>
                  <Label>{label}</Label>
                  <Input
                    disabled={isCreating}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                      setNewValue(e.target.value);
                      setCreateError(null);
                    }}
                    onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                      if (e.key === "Enter" && !isCreating) {
                        void handleCreateNew();
                      }
                    }}
                    placeholder={`Ej: ${label}`}
                    type="text"
                    value={newValue}
                  />
                  {createError && <FieldError>{createError}</FieldError>}
                </TextField>
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
        </Modal.Backdrop>
      </Modal>
    </div>
  );
}
