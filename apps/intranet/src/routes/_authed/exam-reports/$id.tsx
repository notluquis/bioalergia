import { Button, Spinner, Surface } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate, useParams } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";

import { CreateExamReportWizard } from "@/features/exam-reports/components/CreateExamReportWizard";
import { examReportsORPCClient } from "@/features/exam-reports/orpc";
import { examReportsKeys } from "@/features/exam-reports/queries";

/**
 * Exam-report detail / edit page. The route's loader prefetches the
 * persisted report via the React Query cache so the wizard mounts with
 * data already in hand (no flash of empty form). When the id is missing
 * or the server returns 404, we redirect to the list with a search-param
 * `notFound=1` that the index page can surface as a toast.
 */
export const Route = createFileRoute("/_authed/exam-reports/$id")({
  staticData: {
    permission: { action: "update", subject: "ExamReport" },
    title: "Editar informe",
  },
  loader: async ({ context: { queryClient }, params: { id } }) => {
    const numericId = Number(id);
    if (!Number.isFinite(numericId) || numericId <= 0) {
      throw redirect({ to: "/exam-reports", search: { notFound: 1 } });
    }
    try {
      return await queryClient.ensureQueryData(examReportsKeys.detail(numericId));
    } catch {
      throw redirect({ to: "/exam-reports", search: { notFound: 1 } });
    }
  },
  component: ExamReportEditPage,
});

function ExamReportEditPage() {
  const { id } = useParams({ from: "/_authed/exam-reports/$id" });
  const navigate = useNavigate();
  const numericId = Number(id);
  const detailQ = useQuery({
    ...examReportsKeys.detail(numericId),
    queryFn: () => examReportsORPCClient.get({ id: numericId }),
  });

  if (detailQ.isLoading || !detailQ.data) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
        <Surface
          className="flex items-center justify-center gap-2 rounded-2xl p-8 text-default-600"
          variant="default"
        >
          <Spinner size="sm" />
          Cargando informe…
        </Surface>
      </div>
    );
  }

  const report = detailQ.data;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <header className="flex items-center justify-between gap-3">
        <Button
          className="gap-2"
          onPress={() => void navigate({ to: "/exam-reports" })}
          size="sm"
          variant="outline"
        >
          <ChevronLeft className="size-4" />
          Volver a la lista
        </Button>
      </header>

      <CreateExamReportWizard
        initialReport={{
          id: report.id,
          examType: report.examType,
          conclusionText: report.conclusionText,
          conclusionTemplateId: report.conclusionTemplateId,
          notes: report.notes,
          histamineMm: report.histamineMm,
          salineMm: report.salineMm,
          doctorName: report.doctorName,
          doctorSpecialty: report.doctorSpecialty,
          doctorRut: report.doctorRut,
          reagents: report.reagents,
          technique: report.technique,
          patient: report.patient,
          sections: report.sections.map((s) => ({
            sectionKey: s.sectionKey,
            label: s.label,
            reactions: s.reactions.map((r) => ({
              allergenId: r.allergenId,
              reaction: r.reaction,
              papuleMm: r.papuleMm,
              allergen: { commonName: r.allergen.commonName },
            })),
          })),
        }}
        isOpen
        onClose={() => void navigate({ to: "/exam-reports" })}
      />
    </div>
  );
}
