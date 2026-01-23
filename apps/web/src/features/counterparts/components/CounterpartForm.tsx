import { Spinner } from "@heroui/react";
import { useForm, useStore } from "@tanstack/react-form";
import { Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { z } from "zod";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { formatRut, validateRut } from "@/lib/rut";
import { GRID_2_COL_MD } from "@/lib/styles";
import type { CounterpartCategory, PersonType } from "@/types/schema";

import type { CounterpartUpsertPayload } from "../api";
import { CATEGORY_OPTIONS, EMPTY_FORM } from "../constants";
import type { Counterpart } from "../types";

const counterpartFormSchema = z.object({
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
  name: z.string().min(1, "El nombre es requerido"),
  notes: z.string(),

  personType: z.enum(["NATURAL", "JURIDICAL"] as const),
  rut: z.string().refine((value) => {
    if (!value) return true;
    return validateRut(value);
  }, "RUT inválido"),
});

interface CounterpartFormProps {
  counterpart?: Counterpart | null;
  error: null | string;
  loading?: boolean;
  onSave: (payload: CounterpartUpsertPayload) => Promise<void>;
  saving: boolean;
}

type CounterpartFormValues = z.infer<typeof counterpartFormSchema>;

export default function CounterpartForm({
  counterpart,
  error,
  loading = false,
  onSave,
  saving,
}: Readonly<CounterpartFormProps>) {
  const form = useForm({
    defaultValues: {
      category: "OTHER" as CounterpartCategory,
      email: "",
      name: "",
      notes: "",
      personType: "NATURAL" as PersonType,
      rut: "",
    } as CounterpartFormValues,
    onSubmit: async ({ value }) => {
      const payload: CounterpartUpsertPayload = {
        category: value.category,
        email: value.email ?? null,
        employeeEmail: value.email ?? null,
        name: value.name,
        notes: value.notes || null,
        personType: value.personType,
        rut: value.rut || null,
      };
      await onSave(payload);
    },
    validators: {
      onChange: counterpartFormSchema,
    },
  });

  // Reset form when counterpart changes
  useEffect(() => {
    if (counterpart) {
      form.reset({
        category: counterpart.category,
        email: counterpart.email ?? "",
        name: counterpart.name,
        notes: counterpart.notes ?? "",
        personType: counterpart.personType,
        rut: formatRut(counterpart.rut ?? ""),
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
    <section aria-busy={busy} className="surface-recessed relative space-y-5 p-6">
      {loading && (
        <div className="bg-background/60 absolute inset-0 z-10 flex items-center justify-center rounded-2xl backdrop-blur-sm">
          <Spinner size="lg" />
        </div>
      )}
      <div className="flex flex-col gap-1">
        <h1 className="typ-title text-foreground">
          {counterpart ? "Editar contraparte" : "Nueva contraparte"}
        </h1>
        <p className="text-default-600 text-sm">
          Completa los datos principales para sincronizar la información de pagos y retiros.
        </p>
      </div>
      <form
        className={GRID_2_COL_MD}
        onSubmit={(e) => {
          e.preventDefault();
          void form.handleSubmit();
        }}
      >
        <fieldset className="contents" disabled={busy}>
          <form.Field name="rut">
            {(field) => (
              <div>
                <Input
                  helper={rutValue ? formatRut(rutValue) : undefined}
                  label="RUT"
                  onBlur={field.handleBlur}
                  onChange={(e) => {
                    field.handleChange(e.target.value);
                  }}
                  placeholder="12.345.678-9"
                  type="text"
                  value={field.state.value}
                />
                {field.state.meta.errors.length > 0 && (
                  <p className="text-danger mt-1 text-xs">
                    {field.state.meta.errors.map((err) => String(err)).join(", ")}
                  </p>
                )}
              </div>
            )}
          </form.Field>

          <form.Field name="name">
            {(field) => (
              <div>
                <Input
                  label="Nombre"
                  onBlur={field.handleBlur}
                  onChange={(e) => {
                    field.handleChange(e.target.value);
                  }}
                  placeholder="Allos Chile Spa"
                  required
                  type="text"
                  value={field.state.value}
                />
                {field.state.meta.errors.length > 0 && (
                  <p className="text-danger mt-1 text-xs">
                    {field.state.meta.errors.map((err) => String(err)).join(", ")}
                  </p>
                )}
              </div>
            )}
          </form.Field>

          <form.Field name="personType">
            {(field) => (
              <div>
                <Input
                  as="select"
                  label="Tipo de persona"
                  onBlur={field.handleBlur}
                  onChange={(e) => {
                    field.handleChange(e.target.value as PersonType);
                  }}
                  value={field.state.value}
                >
                  <option value="NATURAL">Persona natural</option>
                  <option value="JURIDICAL">Empresa</option>
                </Input>
                {field.state.meta.errors.length > 0 && (
                  <p className="text-danger mt-1 text-xs">
                    {field.state.meta.errors.map((err) => String(err)).join(", ")}
                  </p>
                )}
              </div>
            )}
          </form.Field>

          <form.Field name="category">
            {(field) => (
              <div>
                <Input
                  as="select"
                  label="Clasificación"
                  onBlur={field.handleBlur}
                  onChange={(e) => {
                    field.handleChange(e.target.value as CounterpartCategory);
                  }}
                  value={field.state.value}
                >
                  {CATEGORY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Input>
                {field.state.meta.errors.length > 0 && (
                  <p className="text-danger mt-1 text-xs">
                    {field.state.meta.errors.map((err) => String(err)).join(", ")}
                  </p>
                )}
              </div>
            )}
          </form.Field>

          {categoryValue === "EMPLOYEE" && (
            <p className="text-default-700 text-xs md:col-span-2">
              Se vinculará como empleado utilizando el correo electrónico ingresado.
            </p>
          )}

          <form.Field name="email">
            {(field) => (
              <div>
                <Input
                  label="Correo electrónico"
                  onBlur={field.handleBlur}
                  onChange={(e) => {
                    field.handleChange(e.target.value);
                  }}
                  placeholder="contacto@empresa.cl"
                  type="email"
                  value={field.state.value ?? ""}
                />
                {field.state.meta.errors.length > 0 && (
                  <p className="text-danger mt-1 text-xs">
                    {field.state.meta.errors.map((err) => String(err)).join(", ")}
                  </p>
                )}
              </div>
            )}
          </form.Field>

          {!counterpart && (
            <form.Field name="notes">
              {(field) => (
                <div className="md:col-span-2">
                  <Input
                    as="textarea"
                    label="Notas"
                    onBlur={field.handleBlur}
                    onChange={(e) => {
                      field.handleChange(e.target.value);
                    }}
                    placeholder="Información adicional, persona de contacto, etc."
                    rows={4}
                    value={field.state.value}
                  />
                  {field.state.meta.errors.length > 0 && (
                    <p className="text-danger mt-1 text-xs">
                      {field.state.meta.errors.map((err) => String(err)).join(", ")}
                    </p>
                  )}
                </div>
              )}
            </form.Field>
          )}

          {counterpart?.employeeId && (
            <p className="text-default-700 text-xs md:col-span-2">
              Empleado vinculado (ID #{counterpart.employeeId}).{" "}
              <Link className="text-primary font-semibold" to="/hr/employees">
                Ver empleados
              </Link>
            </p>
          )}

          <div className="flex flex-col gap-3 md:col-span-2">
            {error && <Alert variant="error">{error}</Alert>}
            <div className="flex flex-wrap justify-end gap-2">
              <Button disabled={busy} type="submit">
                {busy ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </div>
        </fieldset>
      </form>
    </section>
  );
}
