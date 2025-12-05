import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { formatRut, validateRut } from "@/lib/rut";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Alert from "@/components/ui/Alert";
import type { Counterpart } from "../types";
import { CATEGORY_OPTIONS, EMPTY_FORM } from "../constants";
import type { CounterpartUpsertPayload } from "../api";
import type { PersonType, CounterpartCategory } from "@/types/schema";

const counterpartFormSchema = z.object({
  rut: z
    .string()
    .trim()
    .default("")
    .refine((value) => {
      if (!value) return true;
      return validateRut(value);
    }, "RUT inválido"),
  name: z.string().trim().min(1, "El nombre es requerido"),
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
  email: z.string().trim().email("Email inválido").or(z.literal("")),
  notes: z.string().trim().default(""),
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
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CounterpartFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(counterpartFormSchema) as any, // Type mismatch between Zod output and RHF expectation
    defaultValues: {
      rut: "",
      name: "",
      personType: "NATURAL",
      category: "OTHER",
      email: "",
      notes: "",
    },
  });

  const values = watch();

  const counterpartSnapshot = useMemo(() => {
    if (!counterpart) return null;
    return {
      rut: formatRut(counterpart.rut ?? ""),
      name: counterpart.name,
      personType: counterpart.personType as PersonType,
      category: counterpart.category as CounterpartCategory,
      email: counterpart.email ?? "",
      notes: counterpart.notes ?? "",
    };
  }, [counterpart]);

  useEffect(() => {
    if (counterpartSnapshot) {
      reset(counterpartSnapshot);
    } else {
      reset({
        ...EMPTY_FORM,
        personType: "NATURAL",
      });
    }
  }, [counterpartSnapshot, reset]);

  const onSubmit = async (values: CounterpartFormValues) => {
    const payload: CounterpartUpsertPayload = {
      rut: values.rut || null,
      name: values.name,
      personType: values.personType,
      category: values.category,
      email: values.email || null,
      employeeEmail: values.email || null,
      notes: values.notes || null,
    };
    await onSave(payload);
  };

  const busy = loading || saving || isSubmitting;

  return (
    <section className="surface-recessed relative space-y-5 p-6" aria-busy={busy}>
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-base-100/60 backdrop-blur-sm">
          <span className="loading loading-spinner loading-lg text-primary" aria-hidden="true" />
        </div>
      )}
      <div className="flex flex-col gap-1">
        <h1 className="typ-title text-base-content">{counterpart ? "Editar contraparte" : "Nueva contraparte"}</h1>
        <p className="text-sm text-base-content/70">
          Completa los datos principales para sincronizar la información de pagos y retiros.
        </p>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 md:grid-cols-2">
        <fieldset className="contents" disabled={busy}>
          <div>
            <Input
              label="RUT"
              type="text"
              {...register("rut")}
              placeholder="12.345.678-9"
              helper={values.rut ? formatRut(values.rut) : undefined}
            />
            {errors.rut && <p className="mt-1 text-xs text-error">{errors.rut.message}</p>}
          </div>
          <div>
            <Input label="Nombre" type="text" {...register("name")} placeholder="Allos Chile Spa" required />
            {errors.name && <p className="mt-1 text-xs text-error">{errors.name.message}</p>}
          </div>
          <div>
            <Input label="Tipo de persona" as="select" {...register("personType")}>
              <option value="NATURAL">Persona natural</option>
              <option value="JURIDICAL">Empresa</option>
            </Input>
            {errors.personType && <p className="mt-1 text-xs text-error">{errors.personType.message}</p>}
          </div>
          <div>
            <Input label="Clasificación" as="select" {...register("category")}>
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Input>
            {errors.category && <p className="mt-1 text-xs text-error">{errors.category.message}</p>}
          </div>
          {values.category === "EMPLOYEE" && (
            <p className="text-xs text-base-content/80 md:col-span-2">
              Se vinculará como empleado utilizando el correo electrónico ingresado.
            </p>
          )}
          <div>
            <Input label="Correo electrónico" type="email" {...register("email")} placeholder="contacto@empresa.cl" />
            {errors.email && <p className="mt-1 text-xs text-error">{errors.email.message}</p>}
          </div>
          {!counterpart && (
            <div className="md:col-span-2">
              <Input
                label="Notas"
                as="textarea"
                rows={4}
                {...register("notes")}
                placeholder="Información adicional, persona de contacto, etc."
              />
              {errors.notes && <p className="mt-1 text-xs text-error">{errors.notes.message}</p>}
            </div>
          )}
          {counterpart?.employeeId && (
            <p className="text-xs text-base-content/80 md:col-span-2">
              Empleado vinculado (ID #{counterpart.employeeId}).{" "}
              <Link to="/hr/employees" className="font-semibold text-primary">
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
