import { EmptyState, Spinner } from "@heroui/react";
import { ClipboardList } from "lucide-react";
import { usePatientClinicalRecords } from "../hooks/useClinicalRecords";
import { RecordCard } from "./RecordCard";

export function PatientRecordsTimeline({ patientId }: { patientId: number | null }) {
  const q = usePatientClinicalRecords(patientId);

  if (!patientId) return null;
  if (q.isLoading)
    return (
      <div className="flex h-32 items-center justify-center">
        <Spinner />
      </div>
    );

  const records = q.data?.records ?? [];
  if (records.length === 0) {
    return (
      <EmptyState className="m-4 p-6 text-center">
        <ClipboardList size={28} className="mx-auto text-default-400" />
        <p className="mt-2 font-medium text-sm">Sin fichas clínicas registradas</p>
        <p className="text-default-500 text-xs">
          Las fichas se importan automáticamente desde OneDrive.
        </p>
      </EmptyState>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {records.map((r) => (
        <RecordCard
          key={r.id}
          consultDate={r.consultDate}
          patientName={r.patientName}
          ageLabel={r.ageLabel}
          history={r.history}
          physicalExam={r.physicalExam}
          diagnosis={r.diagnosis}
          indications={r.indications}
          weightKg={r.weightKg}
          heightCm={r.heightCm}
          headCircumferenceCm={r.headCircumferenceCm}
          anthropometric={r.anthropometric}
        />
      ))}
    </div>
  );
}
