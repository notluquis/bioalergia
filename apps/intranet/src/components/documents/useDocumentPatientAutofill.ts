import { findPersonByRut } from "@/features/people/api";
import { toast } from "@/lib/toast-interceptor";

export interface AutofillFieldMappings<TFormData> {
  patientName: keyof TFormData;
  birthDate?: keyof TFormData;
  address?: keyof TFormData;
}

interface MinimalFormApi<TFormData> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setFieldValue: (field: keyof TFormData, value: any) => void;
}

/**
 * Hook para inyectar datos del paciente en un formulario usando el RUT.
 *
 * @param form Instancia del formulario (TanStack Form).
 * @param fields Mapeo de campos a autocompletar.
 * @returns Una función async para ejecutar en el onBlur del campo RUT.
 */
export function useDocumentPatientAutofill<TFormData>(
  form: MinimalFormApi<TFormData>,
  fields: AutofillFieldMappings<TFormData>
) {
  return async (rutValue: string) => {
    if (!rutValue || rutValue.length < 8) return;
    try {
      const person = await findPersonByRut(rutValue);
      if (person) {
        form.setFieldValue(fields.patientName, person.names);

        if (person.birthDate && fields.birthDate) {
          form.setFieldValue(fields.birthDate, person.birthDate);
        }

        const personRecord = person as unknown as Record<string, unknown>;
        if (personRecord.address && fields.address) {
          const addr = personRecord.address;
          const fullAddr =
            Array.isArray(addr) && addr.length > 0
              ? `${addr[0].street} ${addr[0].streetNumber || ""}`.trim()
              : typeof addr === "string"
                ? addr
                : typeof addr === "object" && addr !== null && "street" in addr
                  ? `${(addr as Record<string, unknown>).street} ${(addr as Record<string, unknown>).streetNumber || ""}`.trim()
                  : "";

          if (fullAddr) {
            form.setFieldValue(fields.address, fullAddr);
          }
        }

        toast.success("Datos del paciente cargados automáticamente");
      }
    } catch (e) {
      console.error("Error fetching patient by rut", e);
    }
  };
}
