import { Button, Chip, Disclosure, Separator, Spinner, Surface } from "@heroui/react";
import { ExternalLink, FileSpreadsheet } from "lucide-react";
import { useSkinTestsBySeries } from "./skin-tests-queries";

export function SeriesSkinTestsSection({ seriesId }: { seriesId: number }) {
  const tests = useSkinTestsBySeries(seriesId);

  if (tests.isLoading) {
    return (
      <div className="flex justify-center py-4">
        <Spinner size="sm" />
      </div>
    );
  }

  if (!tests.data?.length) {
    return null;
  }

  return (
    <>
      <Separator />
      <Disclosure defaultExpanded={false}>
        <Disclosure.Heading>
          <Button
            className="flex w-full items-center justify-between gap-2 px-2 py-1.5 text-sm font-semibold"
            slot="trigger"
            size="sm"
            variant="ghost"
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
            {tests.data.map((test) => (
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
                      variant="ghost"
                      className="ml-auto"
                      onPress={() => window.open(test.oneDriveWebUrl!, "_blank")}
                    >
                      <ExternalLink size={13} />
                      Ver archivo
                    </Button>
                  )}
                </div>
                {(test.clinicalNote || test.physicianName || test.website || test.address) && (
                  <div className="mb-2 rounded-md bg-warning/10 px-2 py-1.5 text-[11px] text-foreground-600">
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
                      className="grid grid-cols-[44px_1fr_48px_48px] gap-1 rounded bg-content2 px-2 py-1 text-[11px]"
                    >
                      <span className="font-mono text-danger">{result.code ?? "-"}</span>
                      <span className="truncate">{result.allergenName}</span>
                      <span>P {result.rawPapule ?? result.papuleMm ?? "-"}</span>
                      <span>E {result.rawErythema ?? result.erythemaMm ?? "-"}</span>
                    </div>
                  ))}
                  {test.results.length > 10 && (
                    <span className="text-[11px] text-foreground-400">
                      +{test.results.length - 10} resultados más
                    </span>
                  )}
                </div>
              </Surface>
            ))}
          </Disclosure.Body>
        </Disclosure.Content>
      </Disclosure>
    </>
  );
}
