import type { ReactNode } from "react";

export interface DocumentPatientSectionProps {
  patientNameField: ReactNode;
  rutField: ReactNode;
  birthDateField?: ReactNode;
  addressField?: ReactNode;
  ageField?: ReactNode;
  /** Título personalizado. Por defecto: "Datos del Paciente" */
  title?: string;
  actionButton?: ReactNode;
}

export function DocumentPatientSection({
  patientNameField,
  rutField,
  birthDateField,
  addressField,
  ageField,
  title = "Datos del Paciente",
  actionButton,
}: DocumentPatientSectionProps) {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold text-foreground text-lg">{title}</h3>
        {actionButton}
      </div>
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
