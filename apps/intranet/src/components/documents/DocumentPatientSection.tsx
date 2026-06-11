import type { ReactNode } from "react";

export interface DocumentPatientSectionProps {
  patientNameField: ReactNode;
  rutField: ReactNode;
  birthDateField?: ReactNode;
  addressField?: ReactNode;
  ageField?: ReactNode;
  /** Título personalizado. Por defecto: "Datos del Paciente" */
  title?: string;
}

export function DocumentPatientSection({
  patientNameField,
  rutField,
  birthDateField,
  addressField,
  ageField,
  title = "Datos del Paciente",
}: DocumentPatientSectionProps) {
  return (
    <div>
      <h3 className="mb-4 font-semibold text-foreground text-lg">{title}</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        {patientNameField}
        {rutField}
        {birthDateField}
        {addressField}
        {ageField}
      </div>
    </div>
  );
}
