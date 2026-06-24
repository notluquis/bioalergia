import {
  Alert,
  Button,
  Card,
  Chip,
  Label,
  Switch,
  TextArea,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from "@heroui/react";
import type { Key } from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { LineChart as LineChartIcon, NotebookPen, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppDatePicker } from "@/components/forms/AppDatePicker";
import { DataTable } from "@/components/data-table/DataTable";
import { confirmAction } from "@/components/ui/ConfirmDialog";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import {
  allergyDiaryKeys,
  deleteEntry,
  listEntries,
  upsertEntry,
} from "@/features/allergy-diary/api";
import type { DiaryEntry } from "@/features/allergy-diary/schemas";
import { useChartPalette } from "@/lib/chart-palette";
import { formatChile } from "@/lib/dates";
import { toast } from "@/lib/toast-interceptor";

// ── Síntomas (6, cada uno 0–3) ──────────────────────────────────────────
const SYMPTOMS = [
  { key: "sneezing", label: "Estornudos" },
  { key: "rhinorrhea", label: "Rinorrea" },
  { key: "nasalItching", label: "Picor nasal" },
  { key: "nasalCongestion", label: "Congestión nasal" },
  { key: "eyeItchingRedness", label: "Picor / enrojecimiento ocular" },
  { key: "eyeWatering", label: "Lagrimeo" },
] as const;

type SymptomKey = (typeof SYMPTOMS)[number]["key"];

const SCORE_OPTIONS = [0, 1, 2, 3] as const;

// Ventana de temporada por defecto: últimos 90 días.
const WINDOW_DAYS = 90;

interface FormState {
  entryDate: string;
  sneezing: number;
  rhinorrhea: number;
  nasalItching: number;
  nasalCongestion: number;
  eyeItchingRedness: number;
  eyeWatering: number;
  medAntihistamine: boolean;
  medIntranasalSteroid: boolean;
  medOralSteroid: boolean;
  notes: string;
}

function initialFormState(): FormState {
  return {
    entryDate: formatChile(new Date(), "YYYY-MM-DD"),
    sneezing: 0,
    rhinorrhea: 0,
    nasalItching: 0,
    nasalCongestion: 0,
    eyeItchingRedness: 0,
    eyeWatering: 0,
    medAntihistamine: false,
    medIntranasalSteroid: false,
    medOralSteroid: false,
    notes: "",
  };
}

interface Props {
  patientId: number;
  personId: number;
}

export function DiaryPanel({ patientId }: Props) {
  const queryClient = useQueryClient();
  const palette = useChartPalette();
  const [form, setForm] = useState<FormState>(() => initialFormState());

  // Ventana de la temporada: últimos WINDOW_DAYS días (incl. hoy).
  const { from, to } = useMemo(() => {
    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - (WINDOW_DAYS - 1));
    return { from: start, to: end };
  }, []);

  const entriesQuery = useQuery({
    queryKey: allergyDiaryKeys.list(patientId, from, to),
    queryFn: () => listEntries({ patientId, from, to }),
  });

  const entries = entriesQuery.data?.entries ?? [];
  const season = entriesQuery.data?.season ?? null;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: allergyDiaryKeys.all });

  const upsert = useMutation({
    mutationFn: () => {
      const date = new Date(`${form.entryDate}T00:00:00`);
      if (Number.isNaN(date.getTime())) {
        throw new Error("Fecha inválida");
      }
      return upsertEntry({
        patientId,
        entryDate: date,
        sneezing: form.sneezing,
        rhinorrhea: form.rhinorrhea,
        nasalItching: form.nasalItching,
        nasalCongestion: form.nasalCongestion,
        eyeItchingRedness: form.eyeItchingRedness,
        eyeWatering: form.eyeWatering,
        medAntihistamine: form.medAntihistamine,
        medIntranasalSteroid: form.medIntranasalSteroid,
        medOralSteroid: form.medOralSteroid,
        notes: form.notes.trim() ? form.notes.trim() : null,
      });
    },
    onSuccess: () => {
      toast.success("Registro guardado");
      setForm(initialFormState());
      void invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo guardar el registro"),
  });

  const remove = useMutation({
    mutationFn: (id: number) => deleteEntry(id),
    onSuccess: () => {
      toast.success("Registro eliminado");
      void invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo eliminar"),
  });

  const onDelete = async (entry: DiaryEntry) => {
    const ok = await confirmAction({
      title: "Eliminar registro",
      description: `¿Eliminar el registro del ${formatChile(entry.entryDate, "DD/MM/YYYY")}? Esta acción no se puede deshacer.`,
      confirmLabel: "Eliminar",
      variant: "danger",
    });
    if (ok) remove.mutate(entry.id);
  };

  const setScore = (key: SymptomKey, value: number) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const columns: ColumnDef<DiaryEntry>[] = [
    {
      header: "Fecha",
      accessorKey: "entryDate",
      cell: ({ row }) => (
        <span className="text-sm">{formatChile(row.original.entryDate, "DD/MM/YYYY")}</span>
      ),
    },
    {
      header: "dSS",
      accessorKey: "dSS",
      cell: ({ row }) => (
        <span className="text-sm tabular-nums">{row.original.dSS.toFixed(2)}</span>
      ),
    },
    {
      header: "dMS",
      accessorKey: "dMS",
      cell: ({ row }) => <span className="text-sm tabular-nums">{row.original.dMS}</span>,
    },
    {
      header: "CSMS",
      accessorKey: "csms",
      cell: ({ row }) => (
        <Chip size="sm" variant="soft">
          {row.original.csms.toFixed(2)}
        </Chip>
      ),
    },
    {
      header: "Medicación",
      id: "meds",
      cell: ({ row }) => (
        <span className="text-default-600 text-sm">{medsSummary(row.original)}</span>
      ),
    },
    {
      header: "Notas",
      accessorKey: "notes",
      cell: ({ row }) => (
        <span className="text-default-500 text-sm">{row.original.notes ?? "—"}</span>
      ),
    },
    {
      header: "",
      id: "actions",
      cell: ({ row }) => (
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="outline"
            isIconOnly
            aria-label="Eliminar registro"
            className="text-danger"
            onPress={() => void onDelete(row.original)}
          >
            <Trash2 size={16} aria-hidden="true" />
          </Button>
        </div>
      ),
    },
  ];

  const completionPct = season ? Math.round(season.completionRate * 100) : 0;
  const showTrend = season !== null && season.isValidSeason;

  // Serie diaria continua para el gráfico (gaps explícitos en días sin registro).
  const chartData = useMemo(() => buildChartSeries(entries, from, to), [entries, from, to]);

  return (
    <div className="space-y-6">
      {/* Banner de seguridad — persistente, no descartable (copy médico obligatorio) */}
      <Alert status="warning">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>Inmunoterapia — seguridad</Alert.Title>
          <Alert.Description>
            Permanecer ≥30 min en observación tras la dosis. Las reacciones pueden ser tardías o
            bifásicas. Emergencia: SAMU 131.
          </Alert.Description>
        </Alert.Content>
      </Alert>

      {/* Tendencia CSMS */}
      <Card className="space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <LineChartIcon size={18} aria-hidden="true" className="text-default-500" />
            <h3 className="font-semibold text-base">
              Tendencia de carga sintomática (CSMS) — para interpretación clínica
            </h3>
          </div>
          {season ? (
            <Chip size="sm" variant="soft" color={season.isValidSeason ? "accent" : "default"}>
              {completionPct}% completado ({season.recordedDays}/{season.windowDays} días)
            </Chip>
          ) : null}
        </div>

        {entriesQuery.isLoading ? (
          <div className="flex justify-center py-10">
            <LoadingSpinner label="Cargando tendencia" />
          </div>
        ) : !showTrend ? (
          <div className="rounded-lg border border-default-200 border-dashed py-10 text-center">
            <p className="font-medium text-default-600 text-sm">
              Datos insuficientes para tendencia
            </p>
            <p className="text-default-400 text-xs">
              Se requiere ≥80% de días registrados en la ventana de {WINDOW_DAYS} días.
            </p>
          </div>
        ) : (
          <div
            className="w-full min-w-0"
            aria-label="Gráfico de tendencia CSMS, dSS y dMS por día"
            role="img"
          >
            <ResponsiveContainer width="100%" height={300} minWidth={0} minHeight={300}>
              <LineChart data={chartData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={palette.grid} />
                <XAxis
                  dataKey="date"
                  stroke={palette.text}
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => formatChile(val, "D MMM")}
                  minTickGap={24}
                />
                <YAxis
                  domain={[0, 6]}
                  ticks={[0, 1, 2, 3, 4, 5, 6]}
                  stroke={palette.text}
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--background)",
                    border: "1px solid var(--default-200)",
                    borderRadius: "0.5rem",
                    fontSize: "0.8125rem",
                  }}
                  labelFormatter={(val) => formatChile(String(val), "DD/MM/YYYY")}
                  formatter={(value, name) => [
                    typeof value === "number" ? value.toFixed(2) : String(value ?? ""),
                    name,
                  ]}
                />
                <Legend wrapperStyle={{ fontSize: "0.8125rem" }} />
                <Line
                  type="monotone"
                  dataKey="csms"
                  name="CSMS (0–6)"
                  stroke={palette.colors[0]}
                  strokeWidth={2.5}
                  dot={false}
                  connectNulls={false}
                />
                <Line
                  type="monotone"
                  dataKey="dSS"
                  name="dSS — síntomas (0–3)"
                  stroke={palette.colors[1]}
                  strokeWidth={2}
                  strokeDasharray="4 3"
                  dot={false}
                  connectNulls={false}
                />
                <Line
                  type="monotone"
                  dataKey="dMS"
                  name="dMS — medicación (0–3)"
                  stroke={palette.colors[2]}
                  strokeWidth={2}
                  strokeDasharray="2 3"
                  dot={false}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
            <p className="mt-2 text-default-400 text-xs">
              Los días sin registro aparecen como cortes en las líneas (sin imputación). El CSMS es
              una carga sintomática agregada para monitoreo clínico.
            </p>
          </div>
        )}
      </Card>

      {/* Formulario de carga asistida por staff */}
      <Card className="space-y-5 p-5">
        <div className="flex items-center gap-2">
          <NotebookPen size={18} aria-hidden="true" className="text-default-500" />
          <h3 className="font-semibold text-base">Registrar día (carga asistida)</h3>
        </div>

        <div className="grid gap-4 sm:max-w-xs">
          <AppDatePicker
            label="Fecha del registro"
            value={form.entryDate}
            onChange={(value) => setForm((prev) => ({ ...prev, entryDate: value }))}
          />
        </div>

        <div className="space-y-4">
          <Label className="font-medium text-sm">Síntomas (0 = ausente · 3 = grave)</Label>
          <div className="grid gap-4 sm:grid-cols-2">
            {SYMPTOMS.map((symptom) => (
              <div key={symptom.key} className="space-y-1.5">
                <Label className="text-default-600 text-sm">{symptom.label}</Label>
                <ToggleButtonGroup
                  fullWidth
                  size="sm"
                  selectionMode="single"
                  disallowEmptySelection
                  aria-label={symptom.label}
                  selectedKeys={new Set<Key>([String(form[symptom.key])])}
                  onSelectionChange={(keys) => {
                    const [first] = [...keys];
                    if (first != null) setScore(symptom.key, Number(first));
                  }}
                >
                  {SCORE_OPTIONS.map((score) => (
                    <ToggleButton key={score} id={String(score)}>
                      {score > 0 ? <ToggleButtonGroup.Separator /> : null}
                      {score}
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <Label className="font-medium text-sm">Medicación de rescate</Label>
          <div className="flex flex-col gap-3">
            <MedSwitch
              label="Antihistamínico (escalón 1)"
              isSelected={form.medAntihistamine}
              onChange={(v) => setForm((prev) => ({ ...prev, medAntihistamine: v }))}
            />
            <MedSwitch
              label="Corticoide intranasal (escalón 2)"
              isSelected={form.medIntranasalSteroid}
              onChange={(v) => setForm((prev) => ({ ...prev, medIntranasalSteroid: v }))}
            />
            <MedSwitch
              label="Corticoide oral (escalón 3)"
              isSelected={form.medOralSteroid}
              onChange={(v) => setForm((prev) => ({ ...prev, medOralSteroid: v }))}
            />
          </div>
        </div>

        <TextField
          value={form.notes}
          onChange={(value) => setForm((prev) => ({ ...prev, notes: value }))}
          maxLength={500}
        >
          <Label className="font-medium text-sm">Notas</Label>
          <TextArea placeholder="Observaciones del día (opcional)…" rows={2} />
        </TextField>

        <div className="flex justify-end">
          <Button className="gap-2" isPending={upsert.isPending} onPress={() => upsert.mutate()}>
            <NotebookPen size={16} aria-hidden="true" />
            Guardar registro
          </Button>
        </div>
      </Card>

      {/* Tabla de registros */}
      {entriesQuery.isLoading ? (
        <div className="flex justify-center py-10">
          <LoadingSpinner label="Cargando registros" />
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={entries}
          enablePagination={false}
          enableToolbar={false}
          noDataMessage="No hay registros para la ventana actual."
          scrollMaxHeight="min(56dvh, 640px)"
        />
      )}
    </div>
  );
}

function MedSwitch({
  label,
  isSelected,
  onChange,
}: {
  label: string;
  isSelected: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <Switch isSelected={isSelected} onChange={onChange} size="sm">
      <Switch.Content>
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
        <Label className="cursor-pointer text-default-600 text-sm">{label}</Label>
      </Switch.Content>
    </Switch>
  );
}

function medsSummary(entry: DiaryEntry): string {
  const parts: string[] = [];
  if (entry.medAntihistamine) parts.push("Antihistamínico");
  if (entry.medIntranasalSteroid) parts.push("Corticoide intranasal");
  if (entry.medOralSteroid) parts.push("Corticoide oral");
  return parts.length > 0 ? parts.join(", ") : "Sin medicación";
}

interface ChartPoint {
  date: string;
  csms: number | null;
  dSS: number | null;
  dMS: number | null;
}

/**
 * Construye una serie diaria continua entre `from` y `to`. Los días sin registro
 * quedan con valores `null` para que `connectNulls={false}` muestre los cortes
 * (honestidad sobre la completitud, NO se imputan ceros).
 */
function buildChartSeries(entries: DiaryEntry[], from: Date, to: Date): ChartPoint[] {
  const byDay = new Map<string, DiaryEntry>();
  for (const entry of entries) {
    byDay.set(formatChile(entry.entryDate, "YYYY-MM-DD"), entry);
  }

  const points: ChartPoint[] = [];
  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);

  while (cursor.getTime() <= end.getTime()) {
    const iso = formatChile(cursor, "YYYY-MM-DD");
    const entry = byDay.get(iso);
    points.push({
      date: iso,
      csms: entry ? entry.csms : null,
      dSS: entry ? entry.dSS : null,
      dMS: entry ? entry.dMS : null,
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return points;
}
