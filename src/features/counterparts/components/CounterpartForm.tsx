import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { z } from "zod";
import { formatRut, normalizeRut } from "../../../lib";
import { useForm } from "../../../hooks";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import Alert from "../../../components/ui/Alert";
import type { Counterpart } from "../types";
import { CATEGORY_OPTIONS, EMPTY_FORM } from "../constants";
import type { CounterpartUpsertPayload } from "../api";

const counterpartFormSchema = z.object({
  rut: z
    .string()
    .trim()
    .optional()
    .transform((value) => value ?? "")
    .refine((value) => {
      if (!value) return true;
      return normalizeRut(value) !== null;
    }, "RUT inválido"),
  name: z.string().trim().min(1, "El nombre es requerido"),
  personType: z.enum(["PERSON", "COMPANY", "OTHER"]),
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
  ]),
  email: z.string().trim().email("Email inválido").or(z.literal("")),
  notes: z
    .string()
    .trim()
    .optional()
    .transform((value) => value ?? ""),
});

interface CounterpartFormProps {
  counterpart?: Counterpart | null;
  onSave: (payload: CounterpartUpsertPayload) => Promise<void>;
  error: string | null;
  saving: boolean;
  loading?: boolean;
}

export default function CounterpartForm({ counterpart, onSave, error, saving, loading = false }: CounterpartFormProps) {
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

  const { getFieldProps, getFieldError, handleSubmit, isSubmitting, values, reset } = form;

  const counterpartSnapshot = useMemo(() => {
    if (!counterpart) return null;
    return {
      rut: formatRut(counterpart.rut ?? ""),
      name: counterpart.name,
      personType: counterpart.personType,
      category: counterpart.category,
      email: counterpart.email ?? "",
      notes: counterpart.notes ?? "",
    };
  }, [counterpart]);

  useEffect(() => {
    if (counterpartSnapshot) {
      reset(counterpartSnapshot);
    } else {
      reset();
    }
  }, [counterpartSnapshot, reset]);

  const busy = loading || saving || isSubmitting;

  return (
    <section className="surface-recessed relative space-y-5 p-6" aria-busy={busy}>
      {loading && (
        <div className="absolute inset-0 z-10 rounded-2xl bg-base-100/60 backdrop-blur-sm flex items-center justify-center">
          <span className="loading loading-spinner loading-lg text-primary" aria-hidden="true" />
        </div>
      )}
      <div className="flex flex-col gap-1">
        <h1 className="typ-title text-base-content">{counterpart ? "Editar contraparte" : "Nueva contraparte"}</h1>
        <p className="text-sm text-base-content/70">
          Completa los datos principales para sincronizar la información de pagos y retiros.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
        <fieldset className="contents" disabled={busy}>
          <div>
            <Input
              label="RUT"
              type="text"
              {...getFieldProps("rut")}
              placeholder="12.345.678-9"
              helper={values.rut ? formatRut(values.rut) : undefined}
            />
            {getFieldError("rut") && <p className="mt-1 text-xs text-error">{getFieldError("rut")}</p>}
          </div>
          <div>
            <Input label="Nombre" type="text" {...getFieldProps("name")} placeholder="Allos Chile Spa" required />
            {getFieldError("name") && <p className="mt-1 text-xs text-error">{getFieldError("name")}</p>}
          </div>
          <div>
            <Input label="Tipo de persona" as="select" {...getFieldProps("personType")}>
              <option value="PERSON">Persona natural</option>
              <option value="COMPANY">Empresa</option>
              <option value="OTHER">Otra</option>
            </Input>
            {getFieldError("personType") && <p className="mt-1 text-xs text-error">{getFieldError("personType")}</p>}
          </div>
          <div>
            <Input label="Clasificación" as="select" {...getFieldProps("category")}>
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Input>
            {getFieldError("category") && <p className="mt-1 text-xs text-error">{getFieldError("category")}</p>}
          </div>
          {values.category === "EMPLOYEE" && (
            <p className="md:col-span-2 text-xs text-base-content/80">
              Se vinculará como empleado utilizando el correo electrónico ingresado.
            </p>
          )}
          <div>
            <Input
              label="Correo electrónico"
              type="email"
              {...getFieldProps("email")}
              placeholder="contacto@empresa.cl"
            />
            {getFieldError("email") && <p className="mt-1 text-xs text-error">{getFieldError("email")}</p>}
          </div>
          {!counterpart && (
            <div className="md:col-span-2">
              <Input
                label="Notas"
                as="textarea"
                rows={4}
                {...getFieldProps("notes")}
                placeholder="Información adicional, persona de contacto, etc."
              />
              {getFieldError("notes") && <p className="mt-1 text-xs text-error">{getFieldError("notes")}</p>}
            </div>
          )}
          {counterpart?.employeeId && (
            <p className="md:col-span-2 text-xs text-base-content/80">
              Empleado vinculado (ID #{counterpart.employeeId}).{" "}
              <Link to="/employees" className="font-semibold text-primary">
                Ver empleados
              </Link>
            </p>
          )}
          <div className="md:col-span-2 flex flex-col gap-3">
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
