// oxlint-disable typescript/no-non-null-assertion -- TODO(strict-null): refactor each `!` to invariant() or explicit guard. Tracked in repo-wide non-null cleanup.
import { Button, Chip, Disclosure, Separator, Spinner, Surface } from "@heroui/react";
import { ExternalLink, FileSpreadsheet, FileText } from "lucide-react";
import { useClinicalDocumentsBySeries, useSkinTestsBySeries } from "./skin-tests-queries";

export function SeriesSkinTestsSection({ seriesId }: { seriesId: number }) {
  const tests = useSkinTestsBySeries(seriesId);
  const documents = useClinicalDocumentsBySeries(seriesId);

  if (tests.isLoading || documents.isLoading) {
    return (
      <div className="flex justify-center py-4">
        <Spinner size="sm" />
      </div>
    );
  }

  if (!tests.data?.length && !documents.data?.length) {
    return null;
  }

  return (
    <>
      <Separator />
      {Boolean(tests.data?.length) && (
        <Disclosure defaultExpanded={false}>
          <Disclosure.Heading>
            <Button
              className="flex w-full items-center justify-between gap-2 px-2 py-1.5 text-sm font-semibold"
              slot="trigger"
              size="sm"
              variant="outline"
            >
              <span className="flex items-center gap-2">
                <FileSpreadsheet size={14} className="text-foreground-400" />
                Tests cutáneos importados
              </span>
              <Disclosure.Indicator />
            </Button>
          </Disclosure.Heading>
          <Disclosure.Content>
            <Disclosure.Body className="space-y-3 p-0 pt-2">
              {tests.data?.map((test) => (
                <Surface key={test.id} className="rounded-lg border border-border p-2">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Chip size="sm" variant="soft" color="accent">
                      {test.testDate}
                    </Chip>
                    {test.nonConclusiveDueToHyperreactivity && (
                      <Chip size="sm" variant="soft" color="warning">
                        No concluyente
                      </Chip>
                    )}
                    {test.panelTitle && (
                      <span className="text-xs text-foreground-500">{test.panelTitle}</span>
                    )}
                    <span className="text-xs text-foreground-400">
                      {test.results.length} resultados
                    </span>
                    {test.oneDriveWebUrl && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="ml-auto"
                        onPress={() => window.open(test.oneDriveWebUrl!, "_blank")}
                      >
                        <ExternalLink size={13} />
                        Ver archivo
                      </Button>
                    )}
                  </div>
                  {(test.clinicalNote || test.physicianName || test.website || test.address) && (
                    <div className="mb-2 rounded-md bg-warning/10 px-2 py-1.5 text-xs text-foreground-600">
                      {test.clinicalNote && (
                        <p className="whitespace-pre-line font-medium text-warning-700">
                          {test.clinicalNote}
                        </p>
                      )}
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-foreground-500">
                        {test.physicianName && <span>{test.physicianName}</span>}
                        {test.physicianSpecialty && <span>{test.physicianSpecialty}</span>}
                        {test.website && <span>{test.website}</span>}
                        {test.address && <span>{test.address}</span>}
                      </div>
                    </div>
                  )}
                  <div className="grid gap-1">
                    {test.results.slice(0, 10).map((result) => (
                      <div
                        key={`${result.section}-${result.code ?? result.allergenName}-${result.sortOrder}`}
                        className="grid grid-cols-[44px_1fr_48px_48px] gap-1 rounded bg-content2 px-2 py-1 text-xs"
                      >
                        <span className="font-mono text-danger">{result.code ?? "-"}</span>
                        <span className="truncate">{result.allergenName}</span>
                        <span>P {result.rawPapule ?? result.papuleMm ?? "-"}</span>
                        <span>E {result.rawErythema ?? result.erythemaMm ?? "-"}</span>
                      </div>
                    ))}
                    {test.results.length > 10 && (
                      <span className="text-xs text-foreground-400">
                        +{test.results.length - 10} resultados más
                      </span>
                    )}
                  </div>
                </Surface>
              ))}
            </Disclosure.Body>
          </Disclosure.Content>
        </Disclosure>
      )}
      {Boolean(documents.data?.length) && (
        <Disclosure defaultExpanded={false}>
          <Disclosure.Heading>
            <Button
              className="flex w-full items-center justify-between gap-2 px-2 py-1.5 text-sm font-semibold"
              slot="trigger"
              size="sm"
              variant="outline"
            >
              <span className="flex items-center gap-2">
                <FileText size={14} className="text-foreground-400" />
                Fichas y documentos importados
              </span>
              <Disclosure.Indicator />
            </Button>
          </Disclosure.Heading>
          <Disclosure.Content>
            <Disclosure.Body className="space-y-2 p-0 pt-2">
              {documents.data?.map((document) => (
                <Surface key={document.id} className="rounded-lg border border-border p-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Chip size="sm" variant="soft" color="default">
                      {DOCUMENT_KIND_LABELS[document.documentKind]}
                    </Chip>
                    <span className="min-w-0 flex-1 truncate text-xs font-medium">
                      {document.filename}
                    </span>
                    {document.oneDriveWebUrl && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="ml-auto"
                        onPress={() => window.open(document.oneDriveWebUrl!, "_blank")}
                      >
                        <ExternalLink size={13} />
                        Ver archivo
                      </Button>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-foreground-500">
                    {document.extractedPatientName && <span>{document.extractedPatientName}</span>}
                    {document.accountEmail && <span>{document.accountEmail}</span>}
                    {document.modifiedAt && <span>{document.modifiedAt.slice(0, 10)}</span>}
                    {document.path && <span className="min-w-0 truncate">{document.path}</span>}
                  </div>
                </Surface>
              ))}
            </Disclosure.Body>
          </Disclosure.Content>
        </Disclosure>
      )}
    </>
  );
}

const DOCUMENT_KIND_LABELS = {
  CLINICAL_RECORD: "Ficha clínica",
  OTHER: "Documento",
  VISIT_SHEET: "Ficha visita",
} as const;
