import {
  Button,
  Card,
  Chip,
  EmptyState,
  Label,
  ListBox,
  SearchField,
  Select,
  Spinner,
} from "@heroui/react";
import { useState } from "react";
import { ClipboardList, FileSearch, RefreshCw } from "lucide-react";
import {
  useApproveClinicalRecordImport,
  useClinicalRecordImports,
  useRejectClinicalRecordImport,
  useReprocessClinicalRecordImport,
} from "../hooks/useClinicalRecords";

const STATUS_OPTIONS = [
  { value: "PENDING_REVIEW", label: "Pendientes" },
  { value: "IMPORTED", label: "Importados" },
  { value: "ERROR", label: "Con error" },
  { value: "REJECTED", label: "Rechazados" },
] as const;

type Status = (typeof STATUS_OPTIONS)[number]["value"];

export function ClinicalRecordsReviewPage() {
  const [status, setStatus] = useState<Status>("PENDING_REVIEW");
  const [search, setSearch] = useState("");
  const list = useClinicalRecordImports({
    status,
    search: search.trim() || undefined,
    page: 1,
    pageSize: 50,
  });
  const reprocess = useReprocessClinicalRecordImport();
  const approve = useApproveClinicalRecordImport();
  const reject = useRejectClinicalRecordImport();

  const items = list.data?.items ?? [];
  const total = list.data?.total ?? 0;

  return (
    <div className="flex flex-col gap-4 p-4">
      <header className="flex items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 font-semibold text-xl">
          <ClipboardList size={20} className="text-primary" />
          Fichas clínicas — revisión
        </h1>
        <Chip variant="soft">
          <Chip.Label>{total} en cola</Chip.Label>
        </Chip>
      </header>

      <Card className="p-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[10rem]">
            <Select
              value={status}
              onChange={(k) => k && setStatus(k as Status)}
              variant="secondary"
            >
              <Label>Estado</Label>
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {STATUS_OPTIONS.map((o) => (
                    <ListBox.Item key={o.value} id={o.value}>
                      {o.label}
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          </div>
          <div className="min-w-[16rem] flex-1">
            <SearchField value={search} onChange={setSearch} aria-label="Buscar archivo">
              <SearchField.Group>
                <SearchField.SearchIcon />
                <SearchField.Input placeholder="Buscar por nombre de archivo" />
                <SearchField.ClearButton />
              </SearchField.Group>
            </SearchField>
          </div>
        </div>
      </Card>

      {list.isLoading ? (
        <div className="flex h-32 items-center justify-center">
          <Spinner />
        </div>
      ) : items.length === 0 ? (
        <EmptyState className="m-4 p-8 text-center">
          <FileSearch size={32} className="mx-auto text-default-400" />
          <p className="mt-2 font-medium text-sm">Sin fichas en este estado</p>
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((it) => {
            const candidates = it.matchCandidates ?? [];
            const top = candidates[0];
            return (
              <li key={it.id}>
                <Card className="p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-sm">{it.filename}</p>
                      <p className="text-default-500 text-xs">
                        {it.parsedPayload?.patientName ?? "Sin nombre parseado"}
                        {it.parsedPayload?.consultDate && ` · ${it.parsedPayload.consultDate}`}
                        {it.parsedPayload?.ageLabel && ` · ${it.parsedPayload.ageLabel}`}
                      </p>
                      {top && (
                        <p className="text-default-500 text-xs">
                          Mejor candidato: {top.fullName}{" "}
                          <span className="text-default-400">({Math.round(top.score * 100)}%)</span>
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Chip
                        size="sm"
                        variant="soft"
                        color={
                          it.status === "ERROR"
                            ? "danger"
                            : it.status === "IMPORTED"
                              ? "success"
                              : it.status === "REJECTED"
                                ? "default"
                                : "warning"
                        }
                      >
                        <Chip.Label>{it.status}</Chip.Label>
                      </Chip>
                      <Chip size="sm" variant="soft">
                        <Chip.Label>conf {it.confidence}</Chip.Label>
                      </Chip>
                      <Button
                        size="sm"
                        variant="secondary"
                        onPress={() => reprocess.mutate(it.id)}
                        isPending={reprocess.isPending && reprocess.variables === it.id}
                      >
                        <RefreshCw size={14} />
                        <span>Re-procesar</span>
                      </Button>
                      {top && it.status === "PENDING_REVIEW" && (
                        <Button
                          size="sm"
                          variant="primary"
                          onPress={() => approve.mutate({ id: it.id, patientId: top.patientId })}
                          isPending={approve.isPending && approve.variables?.id === it.id}
                        >
                          <span>Aprobar → {top.fullName}</span>
                        </Button>
                      )}
                      {it.status === "PENDING_REVIEW" && (
                        <Button
                          size="sm"
                          variant="danger"
                          onPress={() => reject.mutate({ id: it.id })}
                          isPending={reject.isPending && reject.variables?.id === it.id}
                        >
                          <span>Rechazar</span>
                        </Button>
                      )}
                    </div>
                  </div>
                  {(it.issues ?? []).length > 0 && (
                    <ul className="mt-2 list-disc pl-5 text-default-500 text-xs">
                      {(it.issues ?? []).slice(0, 3).map((iss, idx) => (
                        // biome-ignore lint/suspicious/noArrayIndexKey: stable issue index
                        <li key={idx}>
                          <span className="font-mono text-default-700">[{iss.severity}]</span>{" "}
                          {iss.message}
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
