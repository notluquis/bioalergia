import React, { useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import { z } from "zod";
import { useForm } from "../../../hooks";
import Button from "../../../components/Button";
import Input from "../../../components/Input";
import Alert from "../../../components/Alert";
import { apiClient } from "../../../lib";
import type { CommonSupply, StructuredSupplies } from "../types";

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
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
      setErrorMessage(null);
      setSuccessMessage(null);
      try {
        await apiClient.post("/api/supplies/requests", {
          supplyName: values.selectedSupply,
          quantity: values.quantity,
          brand: values.selectedBrand === "N/A" || !values.selectedBrand ? undefined : values.selectedBrand,
          model: values.selectedModel === "N/A" || !values.selectedModel ? undefined : values.selectedModel,
          notes: values.notes || undefined,
        });
        setSuccessMessage("¡Solicitud de insumo enviada con éxito!");
        form.reset();
        onSuccess();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Error al enviar la solicitud";
        setErrorMessage(message);
      }
    },
    validateOnChange: false,
    validateOnBlur: true,
  });

  const structuredSupplies = useMemo(() => {
    return commonSupplies.reduce<StructuredSupplies>((acc, supply) => {
      if (!supply.name) return acc;
      if (!acc[supply.name]) {
        acc[supply.name] = {};
      }
      const brand = supply.brand || "N/A";
      if (!acc[supply.name][brand]) {
        acc[supply.name][brand] = [];
      }
      if (supply.model) {
        acc[supply.name][brand].push(supply.model);
      }
      return acc;
    }, {});
  }, [commonSupplies]);

  const supplyNames = Object.keys(structuredSupplies);
  const availableBrands = form.values.selectedSupply ? Object.keys(structuredSupplies[form.values.selectedSupply]) : [];
  const availableModels =
    form.values.selectedSupply && form.values.selectedBrand
      ? structuredSupplies[form.values.selectedSupply][form.values.selectedBrand]
      : [];

  return (
    <div className="mb-8 p-6 bg-base-100 shadow-md rounded-lg">
      <h2 className="text-xl font-semibold mb-4">Solicitar Nuevo Insumo</h2>
      {successMessage && <Alert variant="success">{successMessage}</Alert>}
      {errorMessage && <Alert variant="error">{errorMessage}</Alert>}
      <form onSubmit={form.handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Input
            label="Nombre del Insumo"
            type="select"
            {...form.getFieldProps("selectedSupply")}
            onChange={(event: ChangeEvent<HTMLSelectElement>) => {
              form.setValue("selectedSupply", event.target.value);
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
          <Input label="Cantidad" type="number" {...form.getFieldProps("quantity")} min="1" required />
          {form.getFieldError("quantity") && (
            <p className="mt-1 text-xs text-red-600">{form.getFieldError("quantity")}</p>
          )}
        </div>
        <div>
          <Input
            label="Marca"
            type="select"
            {...form.getFieldProps("selectedBrand")}
            onChange={(event: ChangeEvent<HTMLSelectElement>) => {
              form.setValue("selectedBrand", event.target.value);
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
            type="select"
            {...form.getFieldProps("selectedModel")}
            disabled={!form.values.selectedBrand || availableModels.length === 0}
          >
            <option value="">Seleccione un modelo</option>
            {availableModels.map((model) => (
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
          <Input label="Notas (Opcional)" type="textarea" rows={3} {...form.getFieldProps("notes")} />
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
