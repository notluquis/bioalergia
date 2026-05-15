import { Button, Chip, Spinner, Surface } from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Download, PlusCircle, Trash2 } from "lucide-react";
import { useState } from "react";

import { fetchPatients } from "@/features/patients/api";
import { CreatePatientModal } from "@/features/patients/components/CreatePatientModal";
import { CreateExamReportWizard } from "@/features/exam-reports/components/CreateExamReportWizard";
import { PatientSelectModal } from "@/features/exam-reports/components/PatientSelectModal";
import { EXAM_TYPE_LABEL } from "@/features/exam-reports/lib/exam-types";

type Patient = Awaited<ReturnType<typeof fetchPatients>>[number];
import { downloadExamReportPdf } from "@/features/exam-reports/lib/pdf";
import { examReportsORPCClient } from "@/features/exam-reports/orpc";
import { examReportsKeys } from "@/features/exam-reports/queries";
import { useToast } from "@/context/ToastContext";
import dayjs from "dayjs";

/**
 * Exam reports list page. Mirrors the ShipmentsPage flow: a "Nuevo
 * Informe" button opens `PatientSelectModal`, escalates to
 * `CreatePatientModal` for unknown patients, then hands the chosen
 * patient to `CreateExamReportWizard`. Existing reports are listed
 * with an inline "Descargar PDF" action.
 */
export const Route = createFileRoute("/_authed/exam-reports")({
  staticData: {
    nav: {
      iconKey: "FileText",
      label: "Informes",
      order: 30,
      section: "Clínica",
    },
    permission: { action: "read", subject: "Patient" },
    title: "Informes — Lista",
  },
  component: ExamReportsListPage,
});

function ExamReportsListPage() {
  const toast = useToast();
  const qc = useQueryClient();

  const [selectPatientOpen, setSelectPatientOpen] = useState(false);
  const [createPatientOpen, setCreatePatientOpen] = useState(false);
  const [wizardPatient, setWizardPatient] = useState<Patient | null>(null);

  const listQ = useQuery(examReportsKeys.list({ limit: 100 }));
  const settingsQ = useQuery(examReportsKeys.clinicSettings());

  const items = listQ.data?.items ?? [];

  const downloadMutation = useMutation({
    mutationFn: async (id: number) => {
      const detail = await examReportsORPCClient.get({ id });
      const settings = settingsQ.data;
      if (!settings) throw new Error("ClinicSettings no cargada");
      await downloadExamReportPdf(
        {
          examType: detail.examType,
          conclusionText: detail.conclusionText,
          reagents: detail.reagents,
          technique: detail.technique,
          notes: detail.notes,
          doctorName: detail.doctorName,
          doctorSpecialty: detail.doctorSpecialty,
          doctorRut: detail.doctorRut,
          patient: {
            fullName: [
              detail.patient.person.names,
              detail.patient.person.fatherName,
              detail.patient.person.motherName,
            ]
              .filter(Boolean)
              .join(" "),
            age: detail.patient.birthDate
              ? `${dayjs().diff(dayjs(detail.patient.birthDate, "YYYY-MM-DD"), "year")} años`
              : null,
            rut: detail.patient.person.rut,
          },
          sections: detail.sections.map((s) => ({
            sectionKey: s.sectionKey,
            label: s.label,
            reactions: s.reactions.map((r) => ({
              reaction: r.reaction,
              allergen: r.allergen,
            })),
          })),
        },
        settings,
        `informe-${EXAM_TYPE_LABEL[detail.examType].replace(/\s+/g, "-")}-${detail.id}.pdf`
      );
      await examReportsORPCClient.markGenerated({ id: detail.id });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: examReportsKeys.lists() }),
    onError: (e) => toast.error((e as Error).message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => examReportsORPCClient.delete({ id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: examReportsKeys.lists() });
      toast.success("Informe eliminado");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-foreground text-xl">Informes de exámenes</h2>
          <p className="text-default-600 text-sm">
            {listQ.data?.total ?? 0} informe(s) generados
          </p>
        </div>
        <Button
          className="gap-2"
          onPress={() => setSelectPatientOpen(true)}
          size="sm"
        >
          <PlusCircle size={16} />
          Nuevo Informe
        </Button>
      </header>

      <Surface variant="default" className="rounded-3xl border border-default-100 p-2">
        {listQ.isLoading ? (
          <div className="flex items-center justify-center gap-2 p-8 text-default-600">
            <Spinner size="sm" />
            Cargando…
          </div>
        ) : items.length === 0 ? (
          <p className="p-8 text-center text-default-600">
            Aún no hay informes. Pulsa "Nuevo Informe" para empezar.
          </p>
        ) : (
          <ul className="divide-y divide-default-100">
            {items.map((r) => {
              const fullName = [
                r.patient.person.names,
                r.patient.person.fatherName,
                r.patient.person.motherName,
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <li
                  className="flex flex-col gap-2 p-3 md:flex-row md:items-center md:justify-between"
                  key={r.id}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="truncate">{fullName}</strong>
                      <span className="font-mono text-default-600 text-xs">
                        {r.patient.person.rut ?? "Sin RUT"}
                      </span>
                      <Chip color="accent" size="sm" variant="primary">
                        {EXAM_TYPE_LABEL[r.examType]}
                      </Chip>
                    </div>
                    <p className="mt-1 line-clamp-1 text-default-600 text-xs">
                      {r.conclusionText}
                    </p>
                    <p className="text-default-600 text-xs">
                      {dayjs(r.createdAt).format("DD MMM YYYY · HH:mm")}
                      {r.generatedAt ? " · PDF descargado" : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      isIconOnly
                      isPending={
                        downloadMutation.isPending &&
                        downloadMutation.variables === r.id
                      }
                      aria-label="Descargar PDF"
                      onPress={() => downloadMutation.mutate(r.id)}
                      size="sm"
                      variant="outline"
                    >
                      <Download className="size-4" />
                    </Button>
                    <Button
                      isIconOnly
                      aria-label="Eliminar"
                      onPress={() => {
                        if (confirm("¿Eliminar este informe?")) {
                          deleteMutation.mutate(r.id);
                        }
                      }}
                      size="sm"
                      variant="danger"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Surface>

      <PatientSelectModal
        isOpen={selectPatientOpen}
        onClose={() => setSelectPatientOpen(false)}
        onSelect={(patient) => {
          setWizardPatient(patient);
          setSelectPatientOpen(false);
        }}
        onCreateNew={() => {
          setSelectPatientOpen(false);
          setCreatePatientOpen(true);
        }}
      />

      <CreatePatientModal
        isOpen={createPatientOpen}
        onClose={() => {
          setCreatePatientOpen(false);
          setSelectPatientOpen(true);
        }}
      />

      {wizardPatient && (
        <CreateExamReportWizard
          isOpen
          onClose={() => setWizardPatient(null)}
          patient={wizardPatient}
        />
      )}
    </div>
  );
}
