import { useForm, useStore } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { useToast } from "@/context/ToastContext";
import { queryKeys } from "@/lib/queryKeys";

import { createSupplyRequest, type SupplyRequestPayload } from "../api";
import type { CommonSupply, StructuredSupplies } from "../types";

const supplyRequestSchema = z.object({
  selectedSupply: z.string().min(1, "Seleccione un insumo"),
  selectedBrand: z.string().optional(),
  selectedModel: z.string().optional(),
  quantity: z.number().int().min(1, "La cantidad debe ser mayor a 0"),
  notes: z.string().optional(),
});

type SupplyRequestFormValues = z.infer<typeof supplyRequestSchema>;

interface SupplyRequestFormProps {
  commonSupplies: CommonSupply[];
  onSuccess: () => void;
}

export default function SupplyRequestForm({ commonSupplies, onSuccess }: SupplyRequestFormProps) {
  const queryClient = useQueryClient();
  const { success: toastSuccess, error: toastError } = useToast();

  const createRequestMutation = useMutation<void, Error, SupplyRequestPayload>({
    mutationFn: createSupplyRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.supplies.requests() });
    },
  });

  const form = useForm({
    defaultValues: {
      selectedSupply: "",
      selectedBrand: "",
      selectedModel: "",
      quantity: 1,
      notes: "",
    } as SupplyRequestFormValues,
    validators: {
      onChange: supplyRequestSchema,
    },
    onSubmit: async ({ value }) => {
      try {
        await createRequestMutation.mutateAsync({
          supplyName: value.selectedSupply,
          quantity: value.quantity,
          brand: value.selectedBrand === "N/A" || !value.selectedBrand ? undefined : value.selectedBrand,
          model: value.selectedModel === "N/A" || !value.selectedModel ? undefined : value.selectedModel,
          notes: value.notes || undefined,
        });
        toastSuccess("Solicitud de insumo enviada");
        form.reset();
        onSuccess();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Error al enviar la solicitud";
        toastError(message);
      }
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
    const brandGroup = acc[supply.name]!;
    if (!brandGroup[brand]) {
      brandGroup[brand] = [];
    }
    if (supply.model) {
      brandGroup[brand]!.push(supply.model);
    }
    return acc;
  }, {});

  const supplyNames = Object.keys(structuredSupplies);
  const availableBrands = selectedSupply ? Object.keys(structuredSupplies[selectedSupply] ?? {}) : [];
  const availableModels =
    selectedSupply && selectedBrand ? (structuredSupplies[selectedSupply]?.[selectedBrand] ?? []) : [];

  return (
    <div className="card bg-base-100 mb-8 p-6 shadow-lg">
      <h2 className="mb-4 text-xl font-semibold">Solicitar nuevo insumo</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
        className="grid grid-cols-1 gap-4 md:grid-cols-2"
      >
        <form.Field name="selectedSupply">
          {(field) => (
            <div>
              <Input
                label="Nombre del insumo"
                as="select"
                value={field.state.value}
                onChange={(e) => {
                  field.handleChange(e.target.value);
                  // Reset dependent fields
                  form.setFieldValue("selectedBrand", "");
                  form.setFieldValue("selectedModel", "");
                }}
                onBlur={field.handleBlur}
                required
              >
                <option value="">Seleccione un insumo</option>
                {supplyNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </Input>
              {field.state.meta.errors.length > 0 && (
                <p className="text-error mt-1 text-xs">{field.state.meta.errors.join(", ")}</p>
              )}
            </div>
          )}
        </form.Field>

        <form.Field name="quantity">
          {(field) => (
            <div>
              <Input
                label="Cantidad"
                type="number"
                min="1"
                required
                inputMode="numeric"
                value={field.state.value}
                onChange={(e) => field.handleChange(Number.parseInt(e.target.value, 10) || 1)}
                onBlur={field.handleBlur}
              />
              {field.state.meta.errors.length > 0 && (
                <p className="text-error mt-1 text-xs">{field.state.meta.errors.join(", ")}</p>
              )}
            </div>
          )}
        </form.Field>

        <form.Field name="selectedBrand">
          {(field) => (
            <div>
              <Input
                label="Marca"
                as="select"
                value={field.state.value ?? ""}
                onChange={(e) => {
                  field.handleChange(e.target.value);
                  form.setFieldValue("selectedModel", "");
                }}
                onBlur={field.handleBlur}
                disabled={!selectedSupply}
              >
                <option value="">Seleccione una marca</option>
                {availableBrands.map((brand) => (
                  <option key={brand} value={brand}>
                    {brand}
                  </option>
                ))}
              </Input>
              {field.state.meta.errors.length > 0 && (
                <p className="text-error mt-1 text-xs">{field.state.meta.errors.join(", ")}</p>
              )}
            </div>
          )}
        </form.Field>

        <form.Field name="selectedModel">
          {(field) => (
            <div>
              <Input
                label="Modelo"
                as="select"
                value={field.state.value ?? ""}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                disabled={!selectedBrand || availableModels.length === 0}
              >
                <option value="">Seleccione un modelo</option>
                {availableModels.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </Input>
              {field.state.meta.errors.length > 0 && (
                <p className="text-error mt-1 text-xs">{field.state.meta.errors.join(", ")}</p>
              )}
            </div>
          )}
        </form.Field>

        <form.Field name="notes">
          {(field) => (
            <div className="md:col-span-2">
              <Input
                label="Notas (opcional)"
                as="textarea"
                rows={3}
                enterKeyHint="done"
                value={field.state.value ?? ""}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
              />
              {field.state.meta.errors.length > 0 && (
                <p className="text-error mt-1 text-xs">{field.state.meta.errors.join(", ")}</p>
              )}
            </div>
          )}
        </form.Field>

        <div className="flex justify-end md:col-span-2">
          <Button type="submit" disabled={form.state.isSubmitting}>
            {form.state.isSubmitting ? "Enviando..." : "Enviar solicitud"}
          </Button>
        </div>
      </form>
    </div>
  );
}
