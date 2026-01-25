import { useForm, useStore } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { Select, SelectItem } from "@/components/ui/Select";
import { useToast } from "@/context/ToastContext";
import { queryKeys } from "@/lib/query-keys";
import { createSupplyRequest, type SupplyRequestPayload } from "../api";
import type { CommonSupply, StructuredSupplies } from "../types";

const supplyRequestSchema = z.object({
  notes: z.string().optional(),
  quantity: z.number().int().min(1, "La cantidad debe ser mayor a 0"),
  selectedBrand: z.string().optional(),
  selectedModel: z.string().optional(),
  selectedSupply: z.string().min(1, "Seleccione un insumo"),
});

interface SupplyRequestFormProps {
  commonSupplies: CommonSupply[];
  onSuccess: () => void;
}

type SupplyRequestFormValues = z.infer<typeof supplyRequestSchema>;

export default function SupplyRequestForm({ commonSupplies, onSuccess }: SupplyRequestFormProps) {
  const queryClient = useQueryClient();
  const { error: toastError, success: toastSuccess } = useToast();

  const createRequestMutation = useMutation<void, Error, SupplyRequestPayload>({
    mutationFn: createSupplyRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.supplies.requests() });
    },
  });

  const form = useForm({
    defaultValues: {
      notes: "",
      quantity: 1,
      selectedBrand: "",
      selectedModel: "",
      selectedSupply: "",
    } as SupplyRequestFormValues,
    onSubmit: async ({ value }) => {
      try {
        await createRequestMutation.mutateAsync({
          brand:
            value.selectedBrand === "N/A" || !value.selectedBrand ? undefined : value.selectedBrand,
          model:
            value.selectedModel === "N/A" || !value.selectedModel ? undefined : value.selectedModel,
          notes: value.notes || undefined,
          quantity: value.quantity,
          supplyName: value.selectedSupply,
        });
        toastSuccess("Solicitud de insumo enviada");
        form.reset();
        onSuccess();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Error al enviar la solicitud";
        toastError(message);
      }
    },
    validators: {
      onChange: supplyRequestSchema,
    },
  });

  const selectedSupply = useStore(form.store, (state) => state.values.selectedSupply);
  const selectedBrand = useStore(form.store, (state) => state.values.selectedBrand);

  const structuredSupplies = commonSupplies.reduce<StructuredSupplies>((acc, supply) => {
    if (!supply.name) return acc;
    const supplyGroup = acc[supply.name];
    if (!supplyGroup) {
      acc[supply.name] = {};
    }
    const brand = supply.brand || "N/A";
    // biome-ignore lint/style/noNonNullAssertion: key exists
    const brandGroup = acc[supply.name]!;
    if (!brandGroup[brand]) {
      brandGroup[brand] = [];
    }
    if (supply.model) {
      brandGroup[brand].push(supply.model);
    }
    return acc;
  }, {});

  const supplyNames = Object.keys(structuredSupplies);
  const availableBrands = selectedSupply
    ? Object.keys(structuredSupplies[selectedSupply] ?? {})
    : [];
  const availableModels =
    selectedSupply && selectedBrand
      ? (structuredSupplies[selectedSupply]?.[selectedBrand] ?? [])
      : [];

  return (
    <form
      className="grid grid-cols-1 gap-4 md:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
    >
      <form.Field name="selectedSupply">
        {(field) => (
          <div>
            <Select
              label="Nombre del insumo"
              placeholder="Seleccione un insumo"
              selectedKey={field.state.value || null}
              onSelectionChange={(key) => {
                field.handleChange(key ? String(key) : "");
                form.setFieldValue("selectedBrand", "");
                form.setFieldValue("selectedModel", "");
              }}
              onBlur={field.handleBlur}
              isRequired
              isInvalid={field.state.meta.errors.length > 0}
              errorMessage={field.state.meta.errors.join(", ")}
            >
              {supplyNames.map((name) => (
                <SelectItem id={name} key={name}>
                  {name}
                </SelectItem>
              ))}
            </Select>
          </div>
        )}
      </form.Field>

      <form.Field name="quantity">
        {(field) => (
          <div>
            <Input
              inputMode="numeric"
              label="Cantidad"
              min="1"
              onBlur={field.handleBlur}
              onChange={(e) => {
                field.handleChange(Number.parseInt(e.target.value, 10) || 1);
              }}
              required
              type="number"
              value={field.state.value}
            />
            {field.state.meta.errors.length > 0 && (
              <p className="text-danger mt-1 text-xs">{field.state.meta.errors.join(", ")}</p>
            )}
          </div>
        )}
      </form.Field>

      <form.Field name="selectedBrand">
        {(field) => (
          <div>
            <Select
              label="Marca"
              placeholder="Seleccione una marca"
              selectedKey={field.state.value || null}
              onSelectionChange={(key) => {
                field.handleChange(key ? String(key) : "");
                form.setFieldValue("selectedModel", "");
              }}
              onBlur={field.handleBlur}
              isDisabled={!selectedSupply}
              isInvalid={field.state.meta.errors.length > 0}
              errorMessage={field.state.meta.errors.join(", ")}
            >
              {availableBrands.map((brand) => (
                <SelectItem id={brand} key={brand}>
                  {brand === "N/A" ? "Sin marca" : brand}
                </SelectItem>
              ))}
            </Select>
          </div>
        )}
      </form.Field>

      <form.Field name="selectedModel">
        {(field) => (
          <div>
            <Select
              label="Modelo"
              placeholder="Seleccione un modelo"
              selectedKey={field.state.value || null}
              onSelectionChange={(key) => {
                field.handleChange(key ? String(key) : "");
              }}
              onBlur={field.handleBlur}
              isDisabled={!selectedBrand || availableModels.length === 0}
              isInvalid={field.state.meta.errors.length > 0}
              errorMessage={field.state.meta.errors.join(", ")}
            >
              {availableModels.map((model) => (
                <SelectItem id={model} key={model}>
                  {model}
                </SelectItem>
              ))}
            </Select>
          </div>
        )}
      </form.Field>

      <form.Field name="notes">
        {(field) => (
          <div className="md:col-span-2">
            <Input
              as="textarea"
              enterKeyHint="done"
              label="Notas (opcional)"
              onBlur={field.handleBlur}
              onChange={(e) => {
                field.handleChange(e.target.value);
              }}
              rows={3}
              value={field.state.value ?? ""}
            />
            {field.state.meta.errors.length > 0 && (
              <p className="text-danger mt-1 text-xs">{field.state.meta.errors.join(", ")}</p>
            )}
          </div>
        )}
      </form.Field>

      <div className="flex justify-end md:col-span-2">
        <Button disabled={form.state.isSubmitting} type="submit">
          {form.state.isSubmitting ? "Enviando..." : "Enviar solicitud"}
        </Button>
      </div>
    </form>
  );
}
