import {
  Alert,
  Button,
  Chip,
  EmptyState,
  Label,
  ListBox,
  Modal,
  NumberField,
  Select,
  TextArea,
  TextField,
} from "@heroui/react";
import type {
  OccupationalProgramStatus2,
  OccupationalSector,
  OccupationalTestingScope,
} from "@finanzas/orpc-contracts/occupational";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { BadgeCheck, FlaskConical, Plus, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { DataTable } from "@/components/data-table/DataTable";
import { ApiError } from "@/lib/api-client";
import { toast } from "@/lib/toast-interceptor";
import {
  attestRiohs,
  createProgram,
  listPrograms,
  occupationalKeys,
  setProgramStatus,
} from "../api";
import type { OccupationalProgram } from "../schemas";
import { TestBatchesPanel } from "./TestBatchesPanel";

const EMPTY: OccupationalProgram[] = [];

const SECTOR_LABEL: Record<OccupationalSector, string> = {
  MINERIA: "Minería",
  TRANSPORTE: "Transporte",
  CONSTRUCCION: "Construcción",
  GENERAL: "General",
  OTRO: "Otro",
};

const SCOPE_LABEL: Record<OccupationalTestingScope, string> = {
  DRUGS: "Drogas",
  ALCOHOL: "Alcohol",
  BOTH: "Drogas y alcohol",
};

const STATUS_LABEL: Record<OccupationalProgramStatus2, string> = {
  DRAFT: "Borrador",
  ACTIVE: "Activo",
  SUSPENDED: "Suspendido",
};

const STATUS_COLOR: Record<OccupationalProgramStatus2, "default" | "success" | "warning"> = {
  DRAFT: "default",
  ACTIVE: "success",
  SUSPENDED: "warning",
};

const SECTOR_OPTIONS = (Object.keys(SECTOR_LABEL) as OccupationalSector[]).map((id) => ({
  id,
  label: SECTOR_LABEL[id],
}));

const SCOPE_OPTIONS = (Object.keys(SCOPE_LABEL) as OccupationalTestingScope[]).map((id) => ({
  id,
  label: SCOPE_LABEL[id],
}));

/**
 * Gestión de programas de salud ocupacional (P7-B). Un programa NO puede
 * activarse sin atestación RIOHS (cláusula del Reglamento Interno del cliente,
 * Código del Trabajo Art. 153/154).
 */
export function ProgramsManager() {
  const programsQuery = useQuery({
    queryKey: occupationalKeys.programs(),
    queryFn: listPrograms,
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [attestFor, setAttestFor] = useState<OccupationalProgram | undefined>(undefined);
  const [batchesFor, setBatchesFor] = useState<OccupationalProgram | undefined>(undefined);

  const programs = programsQuery.data ?? EMPTY;

  const columns = useMemo<ColumnDef<OccupationalProgram>[]>(
    () => [
      {
        accessorKey: "companyName",
        header: "Empresa",
        cell: ({ row }) => (
          <span className="font-medium">
            {row.original.companyName ?? `Empresa #${row.original.companyId}`}
          </span>
        ),
      },
      {
        accessorKey: "sector",
        header: "Sector",
        cell: ({ row }) => SECTOR_LABEL[row.original.sector],
      },
      {
        accessorKey: "testingScope",
        header: "Alcance",
        cell: ({ row }) => SCOPE_LABEL[row.original.testingScope],
      },
      {
        accessorKey: "status",
        header: "Estado",
        cell: ({ row }) => (
          <Chip size="sm" variant="soft" color={STATUS_COLOR[row.original.status]}>
            {STATUS_LABEL[row.original.status]}
          </Chip>
        ),
      },
      {
        id: "riohs",
        header: "RIOHS",
        cell: ({ row }) =>
          row.original.riohsAttested ? (
            <Chip size="sm" variant="soft" color="success" className="gap-1">
              <BadgeCheck size={14} aria-hidden="true" />
              Atestado
            </Chip>
          ) : (
            <Chip size="sm" variant="soft" color="warning">
              Pendiente
            </Chip>
          ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <ProgramActions
            program={row.original}
            onAttest={() => setAttestFor(row.original)}
            onManageBatches={() => setBatchesFor(row.original)}
          />
        ),
      },
    ],
    []
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-default-500 text-sm">
          Un programa no se puede activar sin atestación RIOHS (cláusula del Reglamento Interno del
          cliente, CdT Art. 153/154). Los resultados se registran de forma agregada — sin datos
          individuales del trabajador.
        </p>
        <Button className="gap-2" onPress={() => setCreateOpen(true)}>
          <Plus size={16} aria-hidden="true" />
          Nuevo programa
        </Button>
      </div>

      {!programsQuery.isLoading && programs.length === 0 ? (
        <EmptyState>
          <div className="space-y-3 text-center">
            <p>Aún no hay programas de salud ocupacional.</p>
          </div>
        </EmptyState>
      ) : (
        <DataTable
          columns={columns}
          data={programs}
          isLoading={programsQuery.isLoading}
          enableToolbar={false}
          enableVirtualization={false}
          noDataMessage="Sin programas."
        />
      )}

      <CreateProgramModal isOpen={createOpen} onOpenChange={setCreateOpen} />
      <AttestRiohsModal
        program={attestFor}
        isOpen={attestFor != null}
        onOpenChange={(open) => {
          if (!open) setAttestFor(undefined);
        }}
      />
      <BatchesModal
        program={batchesFor}
        isOpen={batchesFor != null}
        onOpenChange={(open) => {
          if (!open) setBatchesFor(undefined);
        }}
      />
    </div>
  );
}

// ── Acciones por fila ──────────────────────────────────────────────────
function ProgramActions({
  program,
  onAttest,
  onManageBatches,
}: {
  program: OccupationalProgram;
  onAttest: () => void;
  onManageBatches: () => void;
}) {
  const queryClient = useQueryClient();

  const statusMutation = useMutation({
    mutationFn: (status: OccupationalProgramStatus2) =>
      setProgramStatus({ id: program.id, status }),
    onSuccess: (updated) => {
      toast.success(`Programa ${STATUS_LABEL[updated.status].toLowerCase()}`);
      void queryClient.invalidateQueries({ queryKey: occupationalKeys.programs() });
    },
    onError: (e) => {
      // El servidor lanza 409 CONFLICT si se intenta activar sin atestación RIOHS.
      const message =
        e instanceof ApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : "No se pudo cambiar el estado";
      toast.error(message);
    },
  });

  return (
    <div className="flex flex-wrap justify-end gap-2">
      {!program.riohsAttested ? (
        <Button size="sm" variant="secondary" className="gap-1" onPress={onAttest}>
          <ShieldCheck size={14} aria-hidden="true" />
          Atestar RIOHS
        </Button>
      ) : null}

      {program.status !== "ACTIVE" ? (
        <Button
          size="sm"
          className="gap-1"
          isPending={statusMutation.isPending}
          isDisabled={!program.riohsAttested}
          onPress={() => statusMutation.mutate("ACTIVE")}
        >
          Activar
        </Button>
      ) : (
        <Button
          size="sm"
          variant="secondary"
          isPending={statusMutation.isPending}
          onPress={() => statusMutation.mutate("SUSPENDED")}
        >
          Suspender
        </Button>
      )}

      <Button size="sm" variant="secondary" className="gap-1" onPress={onManageBatches}>
        <FlaskConical size={14} aria-hidden="true" />
        Lotes
      </Button>
    </div>
  );
}

// ── Crear programa ─────────────────────────────────────────────────────
function CreateProgramModal({
  isOpen,
  onOpenChange,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  // TODO: reemplazar el NumberField por el CompanyPicker de quotes cuando el
  // backend exponga el listado de empresas para este subject.
  const [companyId, setCompanyId] = useState<number>(0);
  const [sector, setSector] = useState<OccupationalSector>("GENERAL");
  const [scope, setScope] = useState<OccupationalTestingScope>("BOTH");
  const [consentBasis, setConsentBasis] = useState("");
  const [notes, setNotes] = useState("");

  const create = useMutation({
    mutationFn: () => {
      if (!companyId || companyId < 1) throw new Error("Indica el ID de la empresa");
      return createProgram({
        companyId,
        sector,
        testingScope: scope,
        workerConsentBasis: consentBasis.trim() || null,
        notes: notes.trim() || null,
      });
    },
    onSuccess: () => {
      toast.success("Programa creado en borrador");
      void queryClient.invalidateQueries({ queryKey: occupationalKeys.programs() });
      setCompanyId(0);
      setSector("GENERAL");
      setScope("BOTH");
      setConsentBasis("");
      setNotes("");
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo crear el programa"),
  });

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container size="lg">
        <Modal.Dialog aria-label="Nuevo programa de salud ocupacional">
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>Nuevo programa</Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <div className="space-y-4">
              <NumberField
                variant="secondary"
                minValue={1}
                value={companyId || undefined}
                onChange={(v) => setCompanyId(v ?? 0)}
              >
                <Label>ID de empresa</Label>
                <NumberField.Group className="grid-cols-1">
                  <NumberField.Input />
                </NumberField.Group>
              </NumberField>

              <div className="space-y-1">
                <Label className="font-medium text-sm">Sector</Label>
                <Select
                  aria-label="Sector"
                  selectedKey={sector}
                  onSelectionChange={(k) => setSector(String(k) as OccupationalSector)}
                >
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      {SECTOR_OPTIONS.map((opt) => (
                        <ListBox.Item key={opt.id} id={opt.id} textValue={opt.label}>
                          {opt.label}
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="font-medium text-sm">Alcance del testeo</Label>
                <Select
                  aria-label="Alcance del testeo"
                  selectedKey={scope}
                  onSelectionChange={(k) => setScope(String(k) as OccupationalTestingScope)}
                >
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      {SCOPE_OPTIONS.map((opt) => (
                        <ListBox.Item key={opt.id} id={opt.id} textValue={opt.label}>
                          {opt.label}
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>
              </div>

              <TextField value={consentBasis} onChange={setConsentBasis}>
                <Label>Base de consentimiento del trabajador (opcional)</Label>
                <TextArea rows={2} placeholder="Fundamento legal/contractual del consentimiento…" />
              </TextField>

              <TextField value={notes} onChange={setNotes}>
                <Label>Notas (opcional)</Label>
                <TextArea rows={2} placeholder="Notas internas…" />
              </TextField>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button slot="close" variant="secondary">
              Cancelar
            </Button>
            <Button isPending={create.isPending} onPress={() => create.mutate()}>
              Crear programa
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

// ── Atestar RIOHS ──────────────────────────────────────────────────────
function AttestRiohsModal({
  program,
  isOpen,
  onOpenChange,
}: {
  program?: OccupationalProgram;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [clauseRef, setClauseRef] = useState("");
  const [loadedFor, setLoadedFor] = useState<number | undefined>(undefined);

  // Reset del input cuando cambia el programa objetivo.
  if (program && program.id !== loadedFor) {
    setClauseRef(program.riohsClauseRef ?? "");
    setLoadedFor(program.id);
  }

  const attest = useMutation({
    mutationFn: () => {
      if (!program) throw new Error("Sin programa");
      if (!clauseRef.trim()) throw new Error("Indica la cláusula RIOHS");
      return attestRiohs({ id: program.id, riohsClauseRef: clauseRef.trim() });
    },
    onSuccess: () => {
      toast.success("RIOHS atestado — el programa ya puede activarse");
      void queryClient.invalidateQueries({ queryKey: occupationalKeys.programs() });
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo atestar"),
  });

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container size="lg">
        <Modal.Dialog aria-label="Atestar cláusula RIOHS">
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>Atestar RIOHS</Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <div className="space-y-4">
              <Alert status="default">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Description>
                    Referencia la cláusula del Reglamento Interno de Orden, Higiene y Seguridad
                    (RIOHS) del cliente que autoriza el testeo (Código del Trabajo Art. 153/154).
                    Sin esta atestación el programa no puede activarse.
                  </Alert.Description>
                </Alert.Content>
              </Alert>

              <TextField value={clauseRef} onChange={setClauseRef}>
                <Label>Cláusula RIOHS</Label>
                <TextArea
                  rows={3}
                  placeholder="ej. Art. 27 letra c) del RIOHS vigente, aprobado 2025…"
                />
              </TextField>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button slot="close" variant="secondary">
              Cancelar
            </Button>
            <Button
              isPending={attest.isPending}
              isDisabled={!clauseRef.trim()}
              onPress={() => attest.mutate()}
            >
              Atestar
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

// ── Lotes (resultados agregados) ───────────────────────────────────────
function BatchesModal({
  program,
  isOpen,
  onOpenChange,
}: {
  program?: OccupationalProgram;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container size="lg">
        <Modal.Dialog aria-label="Lotes de resultados agregados">
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>
              Resultados agregados
              {program?.companyName ? ` — ${program.companyName}` : ""}
            </Modal.Heading>
          </Modal.Header>
          <Modal.Body>{program ? <TestBatchesPanel program={program} /> : null}</Modal.Body>
          <Modal.Footer>
            <Button slot="close" variant="secondary">
              Cerrar
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
