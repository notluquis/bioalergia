import { useForm, useStore } from "@tanstack/react-form";
import { Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { z } from "zod";

import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { formatRut, validateRut } from "@/lib/rut";
import { GRID_2_COL_MD, LOADING_SPINNER_LG } from "@/lib/styles";
import type { CounterpartCategory, PersonType } from "@/types/schema";

import type { CounterpartUpsertPayload } from "../api";
import { CATEGORY_OPTIONS, EMPTY_FORM } from "../constants";
import type { Counterpart } from "../types";

const counterpartFormSchema = z.object({
  rut: z.string().refine((value) => {
    if (!value) return true;
    return validateRut(value);
  }, "RUT inválido"),
  name: z.string().min(1, "El nombre es requerido"),
  personType: z.enum(["NATURAL", "JURIDICAL"] as const),
  category: z.enum([
    "SUPPLIER",
    "PATIENT",
    "EMPLOYEE",
    "PARTNER",
    "RELATED",
    "OTHER",
    "CLIENT",
    "LENDER",
    "OCCASIONAL",
  ] as const),

  email: z.email().optional().or(z.literal("")),
  notes: z.string(),
});

type CounterpartFormValues = z.infer<typeof counterpartFormSchema>;

interface CounterpartFormProps {
  counterpart?: Counterpart | null;
  onSave: (payload: CounterpartUpsertPayload) => Promise<void>;
  error: string | null;
  saving: boolean;
  loading?: boolean;
}

export default function CounterpartForm({ counterpart, onSave, error, saving, loading = false }: CounterpartFormProps) {
  const form = useForm({
    defaultValues: {
      rut: "",
      name: "",
      personType: "NATURAL" as PersonType,
      category: "OTHER" as CounterpartCategory,
      email: "",
      notes: "",
    } as CounterpartFormValues,
    validators: {
      onChange: counterpartFormSchema,
    },
    onSubmit: async ({ value }) => {
      const payload: CounterpartUpsertPayload = {
        rut: value.rut || null,
        name: value.name,
        personType: value.personType,
        category: value.category,
        email: value.email || null,
        employeeEmail: value.email || null,
        notes: value.notes || null,
      };
      await onSave(payload);
    },
  });

  // Reset form when counterpart changes
  useEffect(() => {
    if (counterpart) {
      form.reset({
        rut: formatRut(counterpart.rut ?? ""),
        name: counterpart.name,
        personType: counterpart.personType as PersonType,
        category: counterpart.category as CounterpartCategory,
        email: counterpart.email ?? "",
        notes: counterpart.notes ?? "",
      });
    } else {
      form.reset({
        ...EMPTY_FORM,
        personType: "NATURAL",
      } as CounterpartFormValues);
    }
  }, [counterpart, form]);

  const busy = loading || saving || form.state.isSubmitting;
  const categoryValue = useStore(form.store, (state) => state.values.category);
  const rutValue = useStore(form.store, (state) => state.values.rut);

  return (
    <section className="surface-recessed relative space-y-5 p-6" aria-busy={busy}>
      {loading && (
        <div className="bg-base-100/60 absolute inset-0 z-10 flex items-center justify-center rounded-2xl backdrop-blur-sm">
          <span className={LOADING_SPINNER_LG} aria-hidden="true" />
        </div>
      )}
      <div className="flex flex-col gap-1">
        <h1 className="typ-title text-base-content">{counterpart ? "Editar contraparte" : "Nueva contraparte"}</h1>
        <p className="text-base-content/70 text-sm">
          Completa los datos principales para sincronizar la información de pagos y retiros.
        </p>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
        className={GRID_2_COL_MD}
      >
        <fieldset className="contents" disabled={busy}>
          <form.Field name="rut">
            {(field) => (
              <div>
                <Input
                  label="RUT"
                  type="text"
                  placeholder="12.345.678-9"
                  helper={rutValue ? formatRut(rutValue) : undefined}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                />
                {field.state.meta.errors.length > 0 && (
                  <p className="text-error mt-1 text-xs">{field.state.meta.errors.join(", ")}</p>
                )}
              </div>
            )}
          </form.Field>

          <form.Field name="name">
            {(field) => (
              <div>
                <Input
                  label="Nombre"
                  type="text"
                  placeholder="Allos Chile Spa"
                  required
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                />
                {field.state.meta.errors.length > 0 && (
                  <p className="text-error mt-1 text-xs">{field.state.meta.errors.join(", ")}</p>
                )}
              </div>
            )}
          </form.Field>

          <form.Field name="personType">
            {(field) => (
              <div>
                <Input
                  label="Tipo de persona"
                  as="select"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value as PersonType)}
                  onBlur={field.handleBlur}
                >
                  <option value="NATURAL">Persona natural</option>
                  <option value="JURIDICAL">Empresa</option>
                </Input>
                {field.state.meta.errors.length > 0 && (
                  <p className="text-error mt-1 text-xs">{field.state.meta.errors.join(", ")}</p>
                )}
              </div>
            )}
          </form.Field>

          <form.Field name="category">
            {(field) => (
              <div>
                <Input
                  label="Clasificación"
                  as="select"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value as CounterpartCategory)}
                  onBlur={field.handleBlur}
                >
                  {CATEGORY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Input>
                {field.state.meta.errors.length > 0 && (
                  <p className="text-error mt-1 text-xs">{field.state.meta.errors.join(", ")}</p>
                )}
              </div>
            )}
          </form.Field>

          {categoryValue === "EMPLOYEE" && (
            <p className="text-base-content/80 text-xs md:col-span-2">
              Se vinculará como empleado utilizando el correo electrónico ingresado.
            </p>
          )}

          <form.Field name="email">
            {(field) => (
              <div>
                <Input
                  label="Correo electrónico"
                  type="email"
                  placeholder="contacto@empresa.cl"
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

          {!counterpart && (
            <form.Field name="notes">
              {(field) => (
                <div className="md:col-span-2">
                  <Input
                    label="Notas"
                    as="textarea"
                    rows={4}
                    placeholder="Información adicional, persona de contacto, etc."
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                  />
                  {field.state.meta.errors.length > 0 && (
                    <p className="text-error mt-1 text-xs">{field.state.meta.errors.join(", ")}</p>
                  )}
                </div>
              )}
            </form.Field>
          )}

          {counterpart?.employeeId && (
            <p className="text-base-content/80 text-xs md:col-span-2">
              Empleado vinculado (ID #{counterpart.employeeId}).{" "}
              <Link to="/hr/employees" className="text-primary font-semibold">
                Ver empleados
              </Link>
            </p>
          )}

          <div className="flex flex-col gap-3 md:col-span-2">
            {error && <Alert variant="error">{error}</Alert>}
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="submit" disabled={busy}>
                {busy ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </div>
        </fieldset>
      </form>
    </section>
  );
}
