import React, { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useForm } from "../../../hooks";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import type { CommonSupply, StructuredSupplies } from "../types";
import { createSupplyRequest, type SupplyRequestPayload } from "../api";
import { queryKeys } from "../../../lib/queryKeys";
import { useToast } from "../../../context/ToastContext";

const supplyRequestSchema = z.object({
  selectedSupply: z.string().min(1, "Seleccione un insumo"),
  selectedBrand: z.string().optional(),
  selectedModel: z.string().optional(),
  quantity: z.number().int().min(1, "La cantidad debe ser mayor a 0"),
  notes: z.string().optional(),
});

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
    initialValues: {
      selectedSupply: "",
      selectedBrand: "",
      selectedModel: "",
      quantity: 1,
      notes: "",
    },
    validationSchema: supplyRequestSchema,
    onSubmit: async (values) => {
      try {
        await createRequestMutation.mutateAsync({
          supplyName: values.selectedSupply,
          quantity: values.quantity,
          brand: values.selectedBrand === "N/A" || !values.selectedBrand ? undefined : values.selectedBrand,
          model: values.selectedModel === "N/A" || !values.selectedModel ? undefined : values.selectedModel,
          notes: values.notes || undefined,
        });
        toastSuccess("Solicitud de insumo enviada");
        form.reset();
        onSuccess();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Error al enviar la solicitud";
        toastError(message);
      }
    },
    validateOnChange: false,
    validateOnBlur: true,
  });

  const structuredSupplies = useMemo(() => {
    return commonSupplies.reduce<StructuredSupplies>((acc, supply) => {
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
  }, [commonSupplies]);

  const supplyNames = Object.keys(structuredSupplies);
  const availableBrands = form.values.selectedSupply
    ? Object.keys(structuredSupplies[form.values.selectedSupply] ?? {})
    : [];
  const availableModels =
    form.values.selectedSupply && form.values.selectedBrand
      ? (structuredSupplies[form.values.selectedSupply!]?.[form.values.selectedBrand!] ?? [])
      : [];

  return (
    <div className="card bg-base-100 shadow-lg p-6 mb-8">
      <h2 className="text-xl font-semibold mb-4">Solicitar Nuevo Insumo</h2>
      <form onSubmit={form.handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Input
            label="Nombre del Insumo"
            as="select"
            {...form.getFieldProps("selectedSupply")}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
              form.setValue("selectedSupply", e.target.value);
              form.setValue("selectedBrand", "");
              form.setValue("selectedModel", "");
            }}
            required
          >
            <option value="">Seleccione un insumo</option>
            {supplyNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </Input>
          {form.getFieldError("selectedSupply") && (
            <p className="mt-1 text-xs text-red-600">{form.getFieldError("selectedSupply")}</p>
          )}
        </div>
        <div>
          <Input
            label="Cantidad"
            type="number"
            {...form.getFieldProps("quantity")}
            min="1"
            required
            inputMode="numeric"
          />
          {form.getFieldError("quantity") && (
            <p className="mt-1 text-xs text-red-600">{form.getFieldError("quantity")}</p>
          )}
        </div>
        <div>
          <Input
            label="Marca"
            as="select"
            {...form.getFieldProps("selectedBrand")}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
              form.setValue("selectedBrand", e.target.value);
              form.setValue("selectedModel", "");
            }}
            disabled={!form.values.selectedSupply}
          >
            <option value="">Seleccione una marca</option>
            {availableBrands.map((brand) => (
              <option key={brand} value={brand}>
                {brand}
              </option>
            ))}
          </Input>
          {form.getFieldError("selectedBrand") && (
            <p className="mt-1 text-xs text-red-600">{form.getFieldError("selectedBrand")}</p>
          )}
        </div>
        <div>
          <Input
            label="Modelo"
            as="select"
            {...form.getFieldProps("selectedModel")}
            disabled={!form.values.selectedBrand || availableModels!.length === 0}
          >
            <option value="">Seleccione un modelo</option>
            {availableModels!.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </Input>
          {form.getFieldError("selectedModel") && (
            <p className="mt-1 text-xs text-red-600">{form.getFieldError("selectedModel")}</p>
          )}
        </div>
        <div className="md:col-span-2">
          <Input label="Notas (Opcional)" as="textarea" rows={3} {...form.getFieldProps("notes")} enterKeyHint="done" />
          {form.getFieldError("notes") && <p className="mt-1 text-xs text-red-600">{form.getFieldError("notes")}</p>}
        </div>
        <div className="md:col-span-2">
          <Button type="submit" disabled={form.isSubmitting}>
            {form.isSubmitting ? "Enviando..." : "Enviar Solicitud"}
          </Button>
        </div>
      </form>
    </div>
  );
}
