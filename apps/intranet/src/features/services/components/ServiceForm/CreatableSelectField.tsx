import {
  Button,
  Description,
  FieldError,
  Input,
  Label,
  ListBox,
  Modal,
  Select,
  TextField,
} from "@heroui/react";
import type { ChangeEvent, KeyboardEvent, ReactNode } from "react";
import { useState } from "react";
import type { z } from "zod";

interface CreatableSelectFieldProps {
  createButtonLabel?: string;
  createSchema: z.ZodSchema;
  description?: ReactNode;
  errors?: string[];
  isDisabled?: boolean;
  isRequired?: boolean;
  label: string;
  onBlur?: () => void;
  onChange: (value: string) => void;
  onCreateNew: (value: string) => void;
  options: Array<{ id: string; label: string }>;
  placeholder?: string;
  value: null | string;
}

export function CreatableSelectField({
  createButtonLabel = "+ Nueva opción",
  createSchema,
  description,
  errors = [],
  isDisabled = false,
  isRequired = false,
  label,
  onBlur,
  onChange,
  onCreateNew,
  options,
  placeholder = "Selecciona...",
  value,
}: Readonly<CreatableSelectFieldProps>) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newValue, setNewValue] = useState("");
  const [createError, setCreateError] = useState<null | string>(null);
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateNew = () => {
    setCreateError(null);
    const parsed = createSchema.safeParse(newValue);
    if (!parsed.success) {
      setCreateError(parsed.error.issues[0]?.message || "Error de validación");
      return;
    }
    setIsCreating(true);
    const validated = parsed.data as string;
    onCreateNew(validated);
    onChange(validated);
    setNewValue("");
    setIsCreateOpen(false);
    setIsCreating(false);
  };

  return (
    <div className="space-y-2">
      <Select
        isDisabled={isDisabled}
        isRequired={isRequired}
        onBlur={onBlur}
        onChange={(key) => {
          if (key) {
            onChange(String(key));
            onBlur?.();
          }
        }}
        placeholder={placeholder}
        value={value || null}
      >
        <Label>{label}</Label>
        <Select.Trigger>
          <Select.Value />
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
        {errors.length > 0 ? <FieldError>{errors.join(", ")}</FieldError> : null}
      </Select>

      {description ? <Description className="text-xs">{description}</Description> : null}

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
                    onChange={(event: ChangeEvent<HTMLInputElement>) => {
                      setNewValue(event.target.value);
                      setCreateError(null);
                    }}
                    onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
                      if (event.key === "Enter" && !isCreating) {
                        handleCreateNew();
                      }
                    }}
                    placeholder={`Ej: ${label}`}
                    type="text"
                    value={newValue}
                  />
                  {createError ? <FieldError>{createError}</FieldError> : null}
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
