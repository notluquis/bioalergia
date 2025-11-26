import React, { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SupplyRequestFormValues>({
    resolver: zodResolver(supplyRequestSchema),
    defaultValues: {
      selectedSupply: "",
      selectedBrand: "",
      selectedModel: "",
      quantity: 1,
      notes: "",
    },
  });

  const selectedSupply = watch("selectedSupply");
  const selectedBrand = watch("selectedBrand");

  const onSubmit = async (values: SupplyRequestFormValues) => {
    try {
      await createRequestMutation.mutateAsync({
        supplyName: values.selectedSupply,
        quantity: values.quantity,
        brand: values.selectedBrand === "N/A" || !values.selectedBrand ? undefined : values.selectedBrand,
        model: values.selectedModel === "N/A" || !values.selectedModel ? undefined : values.selectedModel,
        notes: values.notes || undefined,
      });
      toastSuccess("Solicitud de insumo enviada");
      reset();
      onSuccess();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al enviar la solicitud";
      toastError(message);
    }
  };

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
  const availableBrands = selectedSupply ? Object.keys(structuredSupplies[selectedSupply] ?? {}) : [];
  const availableModels =
    selectedSupply && selectedBrand ? (structuredSupplies[selectedSupply]?.[selectedBrand] ?? []) : [];

  return (
    <div className="card mb-8 bg-base-100 p-6 shadow-lg">
      <h2 className="mb-4 text-xl font-semibold">Solicitar Nuevo Insumo</h2>
      <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <Input
            label="Nombre del Insumo"
            as="select"
            {...register("selectedSupply")}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
              setValue("selectedSupply", e.target.value);
              setValue("selectedBrand", "");
              setValue("selectedModel", "");
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
          {errors.selectedSupply && <p className="mt-1 text-xs text-red-600">{errors.selectedSupply.message}</p>}
        </div>
        <div>
          <Input
            label="Cantidad"
            type="number"
            {...register("quantity", { valueAsNumber: true })}
            min="1"
            required
            inputMode="numeric"
          />
          {errors.quantity && <p className="mt-1 text-xs text-red-600">{errors.quantity.message}</p>}
        </div>
        <div>
          <Input
            label="Marca"
            as="select"
            {...register("selectedBrand")}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
              setValue("selectedBrand", e.target.value);
              setValue("selectedModel", "");
            }}
            disabled={!selectedSupply}
          >
            <option value="">Seleccione una marca</option>
            {availableBrands.map((brand) => (
              <option key={brand} value={brand}>
                {brand}
              </option>
            ))}
          </Input>
          {errors.selectedBrand && <p className="mt-1 text-xs text-red-600">{errors.selectedBrand.message}</p>}
        </div>
        <div>
          <Input
            label="Modelo"
            as="select"
            {...register("selectedModel")}
            disabled={!selectedBrand || availableModels.length === 0}
          >
            <option value="">Seleccione un modelo</option>
            {availableModels.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </Input>
          {errors.selectedModel && <p className="mt-1 text-xs text-red-600">{errors.selectedModel.message}</p>}
        </div>
        <div className="md:col-span-2">
          <Input label="Notas (Opcional)" as="textarea" rows={3} {...register("notes")} enterKeyHint="done" />
          {errors.notes && <p className="mt-1 text-xs text-red-600">{errors.notes.message}</p>}
        </div>
        <div className="md:col-span-2">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Enviando..." : "Enviar Solicitud"}
          </Button>
        </div>
      </form>
    </div>
  );
}
