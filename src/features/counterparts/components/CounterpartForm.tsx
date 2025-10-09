import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { z } from "zod";
import { formatRut, normalizeRut } from "../../../lib";
import { useForm } from "../../../hooks";
import Button from "../../../components/Button";
import Input from "../../../components/Input";
import Alert from "../../../components/Alert";
import type { Counterpart, CounterpartPersonType, CounterpartCategory } from "../types";
import { CATEGORY_OPTIONS, EMPTY_FORM } from "../constants";

const counterpartFormSchema = z.object({
  rut: z
    .string()
    .trim()
    .optional()
    .refine((value) => {
      if (!value) return true;
      return normalizeRut(value) !== null;
    }, "RUT inválido"),
  name: z.string().trim().min(1, "El nombre es requerido"),
  personType: z.enum(["PERSON", "COMPANY", "OTHER"]),
  category: z.enum(["SUPPLIER", "PATIENT", "EMPLOYEE", "PARTNER", "RELATED", "OTHER"]),
  email: z.string().trim().email("Email inválido").optional().or(z.literal("")),
  notes: z.string().trim().optional(),
});

type CounterpartFormData = z.infer<typeof counterpartFormSchema>;

interface CounterpartFormProps {
  counterpart?: Counterpart | null;
  onSave: (payload: any) => Promise<void>;
  error: string | null;
  saving: boolean;
}

export default function CounterpartForm({ counterpart, onSave, error, saving }: CounterpartFormProps) {
  const form = useForm({
    initialValues: EMPTY_FORM,
    validationSchema: counterpartFormSchema,
    onSubmit: async (values) => {
      const payload = {
        rut: values.rut || null,
        name: values.name,
        personType: values.personType,
        category: values.category,
        email: values.email || null,
        employeeEmail: values.email || null,
        notes: values.notes || null,
      };
      await onSave(payload);
    },
    validateOnBlur: true,
  });

  useEffect(() => {
    if (counterpart) {
      form.setValue("rut", counterpart.rut ?? "");
      form.setValue("name", counterpart.name);
      form.setValue("personType", counterpart.personType);
      form.setValue("category", counterpart.category);
      form.setValue("email", counterpart.email ?? "");
      form.setValue("notes", counterpart.notes ?? "");
    } else {
      form.reset();
    }
  }, [counterpart]);

  return (
    <section className="glass-card glass-underlay-gradient space-y-5 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-[var(--brand-primary)] drop-shadow-sm">
          {counterpart ? "Editar contraparte" : "Nueva contraparte"}
        </h1>
        <p className="text-xs text-slate-600/90">
          Completa los datos principales para sincronizar la información de pagos y retiros.
        </p>
      </div>
      <form onSubmit={form.handleSubmit} className="grid gap-4 md:grid-cols-2">
        <div>
          <Input
            label="RUT"
            type="text"
            {...form.getFieldProps("rut")}
            placeholder="12.345.678-9"
            helper={form.values.rut ? formatRut(form.values.rut) : undefined}
          />
          {form.getFieldError("rut") && <p className="mt-1 text-xs text-red-600">{form.getFieldError("rut")}</p>}
        </div>
        <div>
          <Input label="Nombre" type="text" {...form.getFieldProps("name")} placeholder="Allos Chile Spa" required />
          {form.getFieldError("name") && <p className="mt-1 text-xs text-red-600">{form.getFieldError("name")}</p>}
        </div>
        <div>
          <Input label="Tipo de persona" type="select" {...form.getFieldProps("personType")}>
            <option value="PERSON">Persona natural</option>
            <option value="COMPANY">Empresa</option>
            <option value="OTHER">Otra</option>
          </Input>
          {form.getFieldError("personType") && (
            <p className="mt-1 text-xs text-red-600">{form.getFieldError("personType")}</p>
          )}
        </div>
        <div>
          <Input label="Clasificación" type="select" {...form.getFieldProps("category")}>
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Input>
          {form.getFieldError("category") && (
            <p className="mt-1 text-xs text-red-600">{form.getFieldError("category")}</p>
          )}
        </div>
        {form.values.category === "EMPLOYEE" && (
          <p className="md:col-span-2 text-[11px] text-slate-500/80">
            Se vinculará como empleado utilizando el correo electrónico ingresado.
          </p>
        )}
        <div>
          <Input
            label="Correo electrónico"
            type="email"
            {...form.getFieldProps("email")}
            placeholder="contacto@empresa.cl"
          />
          {form.getFieldError("email") && <p className="mt-1 text-xs text-red-600">{form.getFieldError("email")}</p>}
        </div>
        <div className="md:col-span-2">
          <Input
            label="Notas"
            type="textarea"
            rows={4}
            {...form.getFieldProps("notes")}
            placeholder="Información adicional, persona de contacto, etc."
          />
          {form.getFieldError("notes") && <p className="mt-1 text-xs text-red-600">{form.getFieldError("notes")}</p>}
        </div>
        {counterpart?.employeeId && (
          <p className="md:col-span-2 text-xs text-slate-500/80">
            Empleado vinculado (ID #{counterpart.employeeId}).{" "}
            <Link to="/employees" className="font-semibold text-[var(--brand-primary)]">
              Ver empleados
            </Link>
          </p>
        )}
        <div className="md:col-span-2 flex flex-col gap-3">
          {error && <Alert variant="error">{error}</Alert>}
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="submit" disabled={saving || form.isSubmitting}>
              {saving || form.isSubmitting ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </div>
      </form>
    </section>
  );
}
