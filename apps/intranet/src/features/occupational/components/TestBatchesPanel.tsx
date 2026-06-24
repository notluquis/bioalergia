import {
  Alert,
  Button,
  Card,
  Chip,
  DateField,
  Label,
  NumberField,
  TextArea,
  TextField,
} from "@heroui/react";
import type { DateValue } from "@heroui/react";
import { getLocalTimeZone, today } from "@internationalized/date";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { DataTable } from "@/components/data-table/DataTable";
import { formatChile } from "@/lib/dates";
import { toast } from "@/lib/toast-interceptor";
import { createTestBatch, listTestBatches, occupationalKeys } from "../api";
import type { OccupationalProgram, OccupationalTestBatch } from "../schemas";

const EMPTY: OccupationalTestBatch[] = [];

type TestBatchesPanelProps = {
  program: OccupationalProgram;
};

/**
 * Resultados AGREGADOS por lote (sin PHI individual). Cuando la cohorte es
 * menor al umbral (k-anonimato) los conteos vienen suprimidos.
 */
export function TestBatchesPanel({ program }: TestBatchesPanelProps) {
  const queryClient = useQueryClient();
  const batchesQuery = useQuery({
    queryKey: occupationalKeys.batches(program.id),
    queryFn: () => listTestBatches(program.id),
  });

  const [batchDate, setBatchDate] = useState<DateValue | null>(today(getLocalTimeZone()));
  const [totalTested, setTotalTested] = useState<number>(0);
  const [passedCount, setPassedCount] = useState<number>(0);
  const [presumptiveCount, setPresumptiveCount] = useState<number>(0);
  const [notes, setNotes] = useState("");

  // Espeja la regla del servidor: aprobados + presuntivos ≤ total.
  const countsInvalid = passedCount + presumptiveCount > totalTested;

  const create = useMutation({
    mutationFn: async () => {
      if (!batchDate) throw new Error("Indica la fecha del lote");
      if (countsInvalid) {
        throw new Error("Aprobados + presuntivos no puede superar el total testeado");
      }
      return createTestBatch({
        programId: program.id,
        batchDate: batchDate.toDate(getLocalTimeZone()),
        totalTested,
        passedCount,
        presumptivePositiveCount: presumptiveCount,
        notes: notes.trim() || null,
      });
    },
    onSuccess: () => {
      toast.success("Lote de resultados agregado");
      void queryClient.invalidateQueries({ queryKey: occupationalKeys.batches(program.id) });
      setBatchDate(today(getLocalTimeZone()));
      setTotalTested(0);
      setPassedCount(0);
      setPresumptiveCount(0);
      setNotes("");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo agregar el lote"),
  });

  const batches = batchesQuery.data ?? EMPTY;

  const columns = useMemo<ColumnDef<OccupationalTestBatch>[]>(
    () => [
      {
        accessorKey: "batchDate",
        header: "Fecha",
        cell: ({ row }) => (
          <span className="text-sm">{formatChile(row.original.batchDate, "DD/MM/YYYY")}</span>
        ),
      },
      {
        accessorKey: "totalTested",
        header: "Total testeados",
        cell: ({ row }) =>
          row.original.suppressed ? (
            <Chip size="sm" variant="soft" color="default">
              cohorte &lt; 5 (suprimido)
            </Chip>
          ) : (
            (row.original.totalTested ?? "—")
          ),
      },
      {
        accessorKey: "passedCount",
        header: "Aprobados",
        cell: ({ row }) =>
          row.original.suppressed ? (
            <span className="text-default-400">—</span>
          ) : (
            (row.original.passedCount ?? "—")
          ),
      },
      {
        accessorKey: "presumptivePositiveCount",
        header: "Presuntivos (a confirmar)",
        cell: ({ row }) =>
          row.original.suppressed ? (
            <span className="text-default-400">—</span>
          ) : (
            (row.original.presumptivePositiveCount ?? "—")
          ),
      },
      {
        accessorKey: "notes",
        header: "Notas",
        cell: ({ row }) => (
          <span className="text-default-600 text-sm">{row.original.notes?.trim() || "—"}</span>
        ),
      },
    ],
    []
  );

  return (
    <div className="space-y-4">
      <Alert status="default">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>Solo datos agregados</Alert.Title>
          <Alert.Description>
            Estos lotes registran conteos agregados por cohorte — nunca datos individuales del
            trabajador. Los presuntivos son tamizaje a confirmar (GC-MS), no positivos finales. Los
            resultados individuales, la cadena de custodia y el confirmatorio están diferidos
            pendientes de revisión legal.
          </Alert.Description>
        </Alert.Content>
      </Alert>

      <Card className="space-y-4 p-5">
        <h3 className="font-semibold text-base">Nuevo lote agregado</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <DateField value={batchDate} onChange={setBatchDate}>
            <Label>Fecha del lote</Label>
            <DateField.Group>
              <DateField.Input>
                {(segment) => <DateField.Segment segment={segment} />}
              </DateField.Input>
            </DateField.Group>
          </DateField>

          <NumberField
            variant="secondary"
            minValue={0}
            value={totalTested}
            onChange={(v) => setTotalTested(v ?? 0)}
          >
            <Label>Total testeados</Label>
            <NumberField.Group className="grid-cols-1">
              <NumberField.Input />
            </NumberField.Group>
          </NumberField>

          <NumberField
            variant="secondary"
            minValue={0}
            value={passedCount}
            onChange={(v) => setPassedCount(v ?? 0)}
          >
            <Label>Aprobados</Label>
            <NumberField.Group className="grid-cols-1">
              <NumberField.Input />
            </NumberField.Group>
          </NumberField>

          <NumberField
            variant="secondary"
            minValue={0}
            value={presumptiveCount}
            onChange={(v) => setPresumptiveCount(v ?? 0)}
          >
            <Label>Presuntivos (a confirmar)</Label>
            <NumberField.Group className="grid-cols-1">
              <NumberField.Input />
            </NumberField.Group>
          </NumberField>

          <TextField className="lg:col-span-4" value={notes} onChange={setNotes}>
            <Label>Notas (opcional)</Label>
            <TextArea rows={2} placeholder="Notas del lote…" />
          </TextField>
        </div>

        {countsInvalid ? (
          <Alert status="danger">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Description>
                Aprobados + presuntivos ({passedCount + presumptiveCount}) supera el total testeado
                ({totalTested}).
              </Alert.Description>
            </Alert.Content>
          </Alert>
        ) : null}

        <div className="flex justify-end">
          <Button
            className="gap-2"
            isPending={create.isPending}
            isDisabled={countsInvalid}
            onPress={() => create.mutate()}
          >
            <Plus size={16} aria-hidden="true" />
            Agregar lote
          </Button>
        </div>
      </Card>

      <DataTable
        columns={columns}
        data={batches}
        isLoading={batchesQuery.isLoading}
        enableToolbar={false}
        enableVirtualization={false}
        enablePagination={false}
        noDataMessage="Aún no hay lotes de resultados para este programa."
      />
    </div>
  );
}
