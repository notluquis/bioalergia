import {
  Alert,
  Button,
  Calendar,
  Card,
  Chip,
  DateField,
  DatePicker,
  Description,
  Label,
  ProgressBar,
  Skeleton,
  Surface,
} from "@heroui/react";
import { parseDate } from "@internationalized/date";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { History, Play, StopCircle } from "lucide-react";
import { useMemo, useState } from "react";

import { useToast } from "@/context/ToastContext";
import {
  cancelDoctoraliaCalendarBackfill,
  startDoctoraliaCalendarBackfill,
} from "@/features/doctoralia/api";
import { toDoctoraliaApiError } from "@/features/doctoralia/orpc";
import { doctoraliaSettingsKeys } from "@/features/doctoralia/settings-queries";
import type { DoctoraliaCalendarBackfillBucketCounts } from "@/features/doctoralia/types";

function lastCompletedSunday(): string {
  const today = dayjs();
  const weekday = today.day();
  const diff = weekday === 0 ? 7 : weekday;
  return today.subtract(diff, "day").format("YYYY-MM-DD");
}

export function DoctoraliaCalendarBackfillPanel() {
  const toast = useToast();
  const queryClient = useQueryClient();

  const statusQuery = useQuery({
    ...doctoraliaSettingsKeys.backfillStatus(),
    refetchInterval: (query) => (query.state.data?.running ? 5_000 : 30_000),
  });

  const status = statusQuery.data;
  const running = Boolean(status?.running);

  const defaultStartDate = useMemo(() => lastCompletedSunday(), []);
  const defaultEndDate = "2017-08-21";
  const [startDate, setStartDate] = useState<string>(defaultStartDate);
  const [endDate, setEndDate] = useState<string>(defaultEndDate);

  const startMutation = useMutation({
    mutationFn: () => startDoctoraliaCalendarBackfill({ endDate, startDate }),
    onError: (error) => {
      const apiError = toDoctoraliaApiError(error);
      toast.error(apiError.message, "No se pudo iniciar el backfill");
    },
    onSuccess: (data) => {
      queryClient.setQueryData(doctoraliaSettingsKeys.backfillStatus().queryKey, data);
      toast.success(
        `Procesando ${data.weeksTotal} semana(s) hasta ${data.targetEndDate}.`,
        "Backfill iniciado"
      );
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelDoctoraliaCalendarBackfill(),
    onError: (error) => {
      const apiError = toDoctoraliaApiError(error);
      toast.error(apiError.message, "No se pudo cancelar el backfill");
    },
    onSuccess: (data) => {
      queryClient.setQueryData(doctoraliaSettingsKeys.backfillStatus().queryKey, data);
      toast.success("Se detendrá al terminar la semana actual.", "Cancelación solicitada");
    },
  });

  const cancelRequested = Boolean(status?.cancelRequested);

  const minEndDate = status?.minEndDate ?? "2017-08-21";

  const progressPct = useMemo(() => {
    if (!status || status.weeksTotal === 0) return 0;
    return Math.min(100, Math.round((status.weeksProcessed / status.weeksTotal) * 100));
  }, [status]);

  return (
    <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1fr]">
      <Card>
        <Card.Header className="flex flex-col items-start gap-1">
          <h2 className="flex items-center gap-2 font-semibold text-base">
            <History className="size-4" /> Recorrer historial
          </h2>
          <Description className="text-default-500 text-xs">
            Descarga semana a semana entre las fechas seleccionadas. No corre en paralelo al
            scraper: se ejecuta en el backend y actualiza el progreso aquí.
          </Description>
        </Card.Header>
        <Card.Content className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <DatePicker
              aria-label="Fecha de inicio del backfill"
              isDisabled={running}
              minValue={parseDate(minEndDate)}
              maxValue={parseDate(defaultStartDate)}
              onChange={(value) => {
                if (value) setStartDate(value.toString());
              }}
              value={parseDate(startDate)}
            >
              <Label>Desde</Label>
              <DateField.Group>
                <DateField.InputContainer>
                  <DateField.Input>
                    {(segment) => <DateField.Segment segment={segment} />}
                  </DateField.Input>
                </DateField.InputContainer>
                <DateField.Suffix>
                  <DatePicker.Trigger>
                    <DatePicker.TriggerIndicator />
                  </DatePicker.Trigger>
                </DateField.Suffix>
              </DateField.Group>
              <DatePicker.Popover>
                <Calendar aria-label="Fecha inicial del backfill">
                  <Calendar.Header>
                    <Calendar.YearPickerTrigger>
                      <Calendar.YearPickerTriggerHeading />
                      <Calendar.YearPickerTriggerIndicator />
                    </Calendar.YearPickerTrigger>
                    <Calendar.NavButton slot="previous" />
                    <Calendar.NavButton slot="next" />
                  </Calendar.Header>
                  <Calendar.Grid>
                    <Calendar.GridHeader>
                      {(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
                    </Calendar.GridHeader>
                    <Calendar.GridBody>{(date) => <Calendar.Cell date={date} />}</Calendar.GridBody>
                  </Calendar.Grid>
                  <Calendar.YearPickerGrid>
                    <Calendar.YearPickerGridBody>
                      {({ year }) => <Calendar.YearPickerCell year={year} />}
                    </Calendar.YearPickerGridBody>
                  </Calendar.YearPickerGrid>
                </Calendar>
              </DatePicker.Popover>
            </DatePicker>

            <DatePicker
              aria-label="Fecha final del backfill"
              isDisabled={running}
              minValue={parseDate(minEndDate)}
              maxValue={parseDate(startDate)}
              onChange={(value) => {
                if (value) setEndDate(value.toString());
              }}
              value={parseDate(endDate)}
            >
              <Label>Hasta</Label>
              <DateField.Group>
                <DateField.InputContainer>
                  <DateField.Input>
                    {(segment) => <DateField.Segment segment={segment} />}
                  </DateField.Input>
                </DateField.InputContainer>
                <DateField.Suffix>
                  <DatePicker.Trigger>
                    <DatePicker.TriggerIndicator />
                  </DatePicker.Trigger>
                </DateField.Suffix>
              </DateField.Group>
              <DatePicker.Popover>
                <Calendar aria-label="Fecha final del backfill">
                  <Calendar.Header>
                    <Calendar.YearPickerTrigger>
                      <Calendar.YearPickerTriggerHeading />
                      <Calendar.YearPickerTriggerIndicator />
                    </Calendar.YearPickerTrigger>
                    <Calendar.NavButton slot="previous" />
                    <Calendar.NavButton slot="next" />
                  </Calendar.Header>
                  <Calendar.Grid>
                    <Calendar.GridHeader>
                      {(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
                    </Calendar.GridHeader>
                    <Calendar.GridBody>{(date) => <Calendar.Cell date={date} />}</Calendar.GridBody>
                  </Calendar.Grid>
                  <Calendar.YearPickerGrid>
                    <Calendar.YearPickerGridBody>
                      {({ year }) => <Calendar.YearPickerCell year={year} />}
                    </Calendar.YearPickerGridBody>
                  </Calendar.YearPickerGrid>
                </Calendar>
              </DatePicker.Popover>
            </DatePicker>
          </div>

          <Description className="text-default-500 text-xs">
            Las semanas ya cargadas se contarán como "sin cambios" (skipped).
          </Description>

          <div className="flex flex-wrap justify-end gap-2">
            {running ? (
              <Button
                variant="danger"
                isDisabled={cancelRequested || cancelMutation.isPending}
                isPending={cancelMutation.isPending}
                onPress={() => cancelMutation.mutate()}
              >
                <StopCircle className="mr-2 size-4" />
                {cancelRequested ? "Cancelando…" : "Cancelar backfill"}
              </Button>
            ) : null}
            <Button
              isDisabled={running || startMutation.isPending || !endDate}
              isPending={startMutation.isPending}
              onPress={() => startMutation.mutate()}
            >
              <Play className="mr-2 size-4" />
              {running ? "Backfill en curso" : "Iniciar backfill"}
            </Button>
          </div>
        </Card.Content>
      </Card>

      <Card>
        <Card.Header className="flex flex-col items-start gap-1">
          <h2 className="font-semibold text-base">Progreso</h2>
          <Description className="text-default-500 text-xs">
            Estado actual del último backfill manual. Se refresca cada 5 s mientras esté corriendo.
          </Description>
        </Card.Header>
        <Card.Content className="space-y-4">
          {statusQuery.isPending ? (
            <Skeleton className="h-64 w-full rounded-2xl" />
          ) : status ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Chip
                  color={
                    running
                      ? cancelRequested
                        ? "warning"
                        : "accent"
                      : status.lastError
                        ? "danger"
                        : status.endedAt
                          ? "success"
                          : "default"
                  }
                  size="sm"
                  variant="soft"
                >
                  {running
                    ? cancelRequested
                      ? "Cancelando…"
                      : "En curso"
                    : status.lastError
                      ? "Con error"
                      : status.endedAt
                        ? "Finalizado"
                        : "Inactivo"}
                </Chip>
                {status.targetEndDate ? (
                  <Chip size="sm" variant="soft">
                    Hasta {status.targetEndDate}
                  </Chip>
                ) : null}
                {status.startedAt ? (
                  <Chip size="sm" variant="soft">
                    Inicio {formatStatusDate(status.startedAt)}
                  </Chip>
                ) : null}
                {status.endedAt ? (
                  <Chip size="sm" variant="soft">
                    Fin {formatStatusDate(status.endedAt)}
                  </Chip>
                ) : null}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Description className="text-default-500 text-xs uppercase tracking-wide">
                    Semanas procesadas
                  </Description>
                  <span className="font-semibold text-sm">
                    {status.weeksProcessed}/{status.weeksTotal}
                    {status.weeksFailed > 0 ? ` · ${status.weeksFailed} con error` : ""}
                  </span>
                </div>
                <ProgressBar aria-label="Progreso del backfill" value={progressPct}>
                  <ProgressBar.Track className="h-2 rounded-full bg-default-100">
                    <ProgressBar.Fill className={running ? "bg-accent" : "bg-success"} />
                  </ProgressBar.Track>
                </ProgressBar>
              </div>

              {status.currentWindow ? (
                <Surface className="rounded-2xl border border-default-200 px-4 py-3">
                  <Description className="font-semibold text-xs text-default-400">
                    Ventana actual
                  </Description>
                  <p className="mt-1 font-medium text-sm">
                    {status.currentWindow.from} → {status.currentWindow.to}
                  </p>
                </Surface>
              ) : null}

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <SummaryCell label="Agendas" counts={status.schedules} />
                <SummaryCell label="Citas" counts={status.appointments} />
                <SummaryCell label="Horarios" counts={status.workPeriods} />
              </div>

              {status.lastError ? (
                <Alert status="danger">
                  <Alert.Indicator />
                  <Alert.Content>
                    <Alert.Title>Último error</Alert.Title>
                    <Alert.Description>{status.lastError}</Alert.Description>
                  </Alert.Content>
                </Alert>
              ) : null}
            </>
          ) : (
            <Alert status="warning">
              <Alert.Content>
                <Alert.Description>No se pudo cargar el estado del backfill.</Alert.Description>
              </Alert.Content>
            </Alert>
          )}
        </Card.Content>
      </Card>
    </div>
  );
}

function SummaryCell({
  label,
  counts,
}: {
  label: string;
  counts: DoctoraliaCalendarBackfillBucketCounts;
}) {
  return (
    <div className="rounded-md border border-default-100 bg-background p-2 text-xs">
      <p className="mb-1 font-medium text-default-700">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        <Chip size="sm" variant="soft" color="success">
          +{counts.inserted}
        </Chip>
        <Chip size="sm" variant="soft" color="accent">
          ↻{counts.updated}
        </Chip>
        <Chip size="sm" variant="soft">
          ={counts.skipped}
        </Chip>
      </div>
    </div>
  );
}

function formatStatusDate(value: string | null) {
  return value ? dayjs(value).format("DD/MM HH:mm") : "—";
}
