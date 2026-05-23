import { Button, Card, Chip, Separator, Skeleton } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { ExternalLink, FlaskConical } from "lucide-react";
import { useMemo, useState } from "react";
import { useSkinTestsBySeries } from "@/features/clinical-series/skin-tests-queries";
import type { SkinTestDetail, SkinTestResult } from "@/features/clinical-series/skin-tests-types";
import { fetchPatientSkinTests } from "../api";

const KIND_LABEL: Record<string, string> = {
  PATCH_TEST: "Parche",
  SKIN_TEST: "Test cutáneo",
  SUBCUTANEOUS_TREATMENT: "Subcutáneo",
};

const KIND_COLOR: Record<string, "warning" | "accent" | "success" | "default"> = {
  PATCH_TEST: "warning",
  SKIN_TEST: "accent",
  SUBCUTANEOUS_TREATMENT: "success",
};

export function SkinTestsList({ patientId }: { patientId: number }) {
  const [selectedId, setSelectedId] = useState<null | string>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["patient-skin-tests", patientId],
    queryFn: () => fetchPatientSkinTests(patientId),
    staleTime: 1000 * 60,
  });

  const tests = data?.items ?? [];
  const selected = tests.find((test) => test.id === selectedId) ?? tests[0] ?? null;
  const detailQuery = useSkinTestsBySeries(selected?.seriesId ?? null);
  const detail =
    detailQuery.data?.find((test) => test.id === selected?.id) ?? detailQuery.data?.[0] ?? null;

  if (isLoading) {
    return <SkinTestsSkeleton />;
  }

  if (tests.length === 0) {
    return (
      <Card className="border-none bg-background shadow-sm">
        <Card.Header className="items-center gap-3">
          <FlaskConical size={18} className="text-default-400" />
          <div>
            <Card.Title className="text-base">Exámenes</Card.Title>
            <Card.Description>No hay exámenes vinculados a este paciente.</Card.Description>
          </div>
        </Card.Header>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
      <Card className="border-none bg-background shadow-sm">
        <Card.Header className="gap-3">
          <FlaskConical size={18} className="text-accent" />
          <div>
            <Card.Title className="text-base">Exámenes</Card.Title>
            <Card.Description>{tests.length} test(s) cutáneo(s) importados</Card.Description>
          </div>
        </Card.Header>
        <Card.Content className="space-y-2 pt-0">
          {tests.map((test) => (
            <Button
              key={test.id}
              variant={test.id === selected?.id ? "secondary" : "ghost"}
              className="h-auto w-full justify-start px-3 py-2 text-left"
              onPress={() => setSelectedId(test.id)}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{test.panelTitle ?? "Test cutáneo"}</p>
                <p className="text-default-500 text-xs">
                  {dayjs(test.testDate).format("DD/MM/YYYY")} · {test.resultsCount} resultados
                </p>
              </div>
              <Chip
                size="sm"
                variant="soft"
                color={KIND_COLOR[test.seriesKind] ?? "default"}
                className="shrink-0"
              >
                <Chip.Label>{KIND_LABEL[test.seriesKind] ?? test.seriesKind}</Chip.Label>
              </Chip>
            </Button>
          ))}
        </Card.Content>
      </Card>

      <Card className="border-none bg-background shadow-sm" data-phi-block>
        {detailQuery.isLoading ? (
          <SkinTestDetailSkeleton />
        ) : detail ? (
          <SkinTestDetailView test={detail} />
        ) : (
          <Card.Content className="p-6">
            <Card.Description>No se pudo cargar el detalle de este examen.</Card.Description>
          </Card.Content>
        )}
      </Card>
    </div>
  );
}

function SkinTestsSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
      <Card className="border-none bg-background shadow-sm">
        <Card.Header className="gap-3">
          <Skeleton className="size-5 rounded-md" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-28 rounded-md" />
            <Skeleton className="h-4 w-44 rounded-md" />
          </div>
        </Card.Header>
        <Card.Content className="space-y-2 pt-0">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-14 rounded-md" />
          ))}
        </Card.Content>
      </Card>
      <Card className="border-none bg-background shadow-sm">
        <SkinTestDetailSkeleton />
      </Card>
    </div>
  );
}

function SkinTestDetailSkeleton() {
  return (
    <>
      <Card.Header className="items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-6 w-64 rounded-md" />
          <Skeleton className="h-4 w-40 rounded-md" />
        </div>
        <Skeleton className="h-8 w-24 rounded-md" />
      </Card.Header>
      <Card.Content className="space-y-4 pt-0">
        <div className="flex gap-2">
          <Skeleton className="h-6 w-24 rounded-md" />
          <Skeleton className="h-6 w-20 rounded-md" />
        </div>
        <Separator />
        <div className="space-y-2">
          <Skeleton className="h-5 w-36 rounded-md" />
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-10 w-4/5 rounded-md" />
        </div>
      </Card.Content>
    </>
  );
}

function SkinTestDetailView({ test }: { test: SkinTestDetail }) {
  return (
    <>
      <Card.Header className="items-start justify-between gap-4">
        <div className="min-w-0">
          <Card.Title className="truncate text-lg">{test.panelTitle ?? "Test cutáneo"}</Card.Title>
          <Card.Description>
            {dayjs(test.testDate).format("DD/MM/YYYY")} · {test.results.length} resultados
          </Card.Description>
        </div>
        {test.oneDriveWebUrl ? (
          <Button
            size="sm"
            variant="outline"
            className="shrink-0 gap-2"
            onPress={() => window.open(test.oneDriveWebUrl ?? undefined, "_blank")}
          >
            <ExternalLink size={14} />
            Archivo
          </Button>
        ) : null}
      </Card.Header>

      <Card.Content className="space-y-4 pt-0">
        <div className="flex flex-wrap gap-2">
          {test.patientRut ? (
            <Chip size="sm" variant="soft" color="accent">
              <Chip.Label>{test.patientRut}</Chip.Label>
            </Chip>
          ) : null}
          {test.ageLabel ? (
            <Chip size="sm" variant="soft">
              <Chip.Label>{test.ageLabel}</Chip.Label>
            </Chip>
          ) : null}
          {test.nonConclusiveDueToHyperreactivity ? (
            <Chip size="sm" variant="soft" color="warning">
              <Chip.Label>No concluyente</Chip.Label>
            </Chip>
          ) : null}
        </div>

        {test.clinicalNote || test.physicianName || test.physicianSpecialty ? (
          <div className="rounded-md bg-content2 p-3 text-sm">
            {test.clinicalNote ? (
              <p className="whitespace-pre-line font-medium">{test.clinicalNote}</p>
            ) : null}
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-default-500 text-xs">
              {test.physicianName ? <span>{test.physicianName}</span> : null}
              {test.physicianSpecialty ? <span>{test.physicianSpecialty}</span> : null}
              {test.website ? <span>{test.website}</span> : null}
              {test.address ? <span>{test.address}</span> : null}
            </div>
          </div>
        ) : null}

        <Separator />
        <SkinTestResults results={test.results} />
      </Card.Content>
    </>
  );
}

function SkinTestResults({ results }: { results: SkinTestResult[] }) {
  const grouped = useMemo(() => {
    return results.reduce((acc, result) => {
      const rows = acc.get(result.section) ?? [];
      rows.push(result);
      acc.set(result.section, rows);
      return acc;
    }, new Map<string, SkinTestResult[]>());
  }, [results]);

  return (
    <div className="space-y-4">
      {Array.from(grouped.entries()).map(([section, rows]) => (
        <div key={section} className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold text-default-700 text-sm">{section}</h3>
            <Chip size="sm" variant="soft">
              <Chip.Label>{rows.length} resultados</Chip.Label>
            </Chip>
          </div>
          <div className="overflow-hidden rounded-md border border-default-100">
            <div className="grid grid-cols-[72px_minmax(0,1fr)_72px_72px] gap-2 bg-content2 px-3 py-2 font-medium text-default-500 text-xs">
              <span>Código</span>
              <span>Alérgeno</span>
              <span>Pápula</span>
              <span>Eritema</span>
            </div>
            {rows.map((result) => (
              <div
                key={`${result.section}-${result.code ?? result.allergenName}-${result.sortOrder}`}
                className="grid grid-cols-[72px_minmax(0,1fr)_72px_72px] gap-2 border-default-100 border-t px-3 py-2 text-sm"
              >
                <span className="font-mono text-danger">{result.code ?? "-"}</span>
                <span className="min-w-0 truncate">{result.allergenName}</span>
                <span>{result.rawPapule ?? result.papuleMm ?? "-"}</span>
                <span>{result.rawErythema ?? result.erythemaMm ?? "-"}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
