import type { Meta, StoryObj } from "@storybook/react-vite";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";

import type { CalendarEventDetail } from "../types";
import { WeekGrid } from "./WeekGrid";

dayjs.extend(isoWeek);

// Stories for the weekly schedule grid. The component does its own time
// math (UTC → America/Santiago), overlap-aware column layout (max 6) and
// a live "now" indicator. Variants exercise: empty, light week, busy week
// with overlaps, single day with stacked events, and loading.
//
// We pass `weekStart` as the Monday of a fixed week so screenshots are
// deterministic regardless of when the story is captured.

const FIXED_MONDAY = "2026-05-11";

function eventAt({
  id,
  day,
  start,
  end,
  summary,
  category,
  colorId,
}: {
  id: string;
  day: number; // 0=Mon..5=Sat
  start: string; // HH:mm Chile local
  end: string;
  summary: string;
  category?: CalendarEventDetail["category"];
  colorId?: string;
}): CalendarEventDetail {
  // Chile = UTC-4 (no DST in effect). Build the UTC ISO that, after
  // tz("America/Santiago"), reads back as the desired local hh:mm.
  const date = dayjs(FIXED_MONDAY).add(day, "day").format("YYYY-MM-DD");
  const toUtc = (hhmm: string) => {
    const [hStr, mStr] = hhmm.split(":");
    const h = Number(hStr ?? "0");
    const m = Number(mStr ?? "0");
    return dayjs(
      `${date}T${String(h + 4).padStart(2, "0")}:${String(m).padStart(2, "0")}:00.000Z`
    ).toISOString();
  };
  return {
    amountExpected: null,
    amountPaid: null,
    attended: null,
    beneficiaryName: null,
    beneficiaryRut: null,
    calendarId: "cal-bioalergia",
    category: category ?? null,
    clinicalSeriesId: null,
    colorId: colorId ?? null,
    controlIncluded: null,
    description: null,
    dosageValue: null,
    dosageUnit: null,
    seriesStageKind: null,
    seriesStageLabel: null,
    seriesStageNumber: null,
    endDate: null,
    endDateTime: toUtc(end),
    endTimeZone: null,
    eventCreatedAt: null,
    eventDate: date,
    eventDateTime: null,
    eventId: id,
    eventType: null,
    eventUpdatedAt: null,
    hangoutLink: null,
    isDomicilio: null,
    location: null,
    patientName: null,
    patientRut: null,
    rawEvent: null,
    startDate: null,
    startDateTime: toUtc(start),
    startTimeZone: null,
    status: "confirmed",
    summary,
    testMetadata: null,
    transparency: null,
    treatmentStage: null,
    visibility: "default",
  };
}

const LIGHT_WEEK: CalendarEventDetail[] = [
  eventAt({
    id: "lw-1",
    day: 0,
    start: "10:00",
    end: "10:30",
    summary: "Camila Soto — Inmunoterapia",
    category: "Tratamiento subcutáneo",
  }),
  eventAt({
    id: "lw-2",
    day: 2,
    start: "15:00",
    end: "16:00",
    summary: "Felipe Castillo — Test cutáneo",
    category: "Test y exámenes",
  }),
  eventAt({
    id: "lw-3",
    day: 4,
    start: "11:30",
    end: "12:00",
    summary: "Joaquín Reyes — Inyección",
    category: "Inyección",
  }),
];

// Busy week with overlaps inside a single morning to exercise column layout.
const BUSY_WEEK: CalendarEventDetail[] = [
  eventAt({
    id: "bw-1",
    day: 0,
    start: "09:00",
    end: "10:00",
    summary: "Camila Soto — Inmunoterapia vial 4",
    category: "Tratamiento subcutáneo",
  }),
  eventAt({
    id: "bw-2",
    day: 0,
    start: "09:30",
    end: "10:30",
    summary: "Felipe Castillo — Panel inhalantes",
    category: "Test y exámenes",
  }),
  eventAt({
    id: "bw-3",
    day: 0,
    start: "10:00",
    end: "11:00",
    summary: "Joaquín Reyes — Inyección domicilio",
    category: "Inyección",
  }),
  eventAt({
    id: "bw-4",
    day: 1,
    start: "11:00",
    end: "11:30",
    summary: "Macarena Vidal — Control",
    category: "Tratamiento subcutáneo",
  }),
  eventAt({
    id: "bw-5",
    day: 1,
    start: "16:00",
    end: "17:30",
    summary: "Sebastián Rojas — Parche europeo",
    category: "Test y exámenes",
  }),
  eventAt({
    id: "bw-6",
    day: 2,
    start: "10:00",
    end: "10:20",
    summary: "Inyección rápida",
    category: "Inyección",
  }),
  eventAt({
    id: "bw-7",
    day: 3,
    start: "13:00",
    end: "14:30",
    summary: "Camila Soto — Inmunoterapia + control",
    category: "Tratamiento subcutáneo",
  }),
  eventAt({
    id: "bw-8",
    day: 4,
    start: "09:00",
    end: "10:00",
    summary: "Bloque test cutáneo",
    category: "Test y exámenes",
  }),
  eventAt({
    id: "bw-9",
    day: 4,
    start: "09:30",
    end: "11:00",
    summary: "Bloque test cutáneo 2",
    category: "Test y exámenes",
  }),
  eventAt({
    id: "bw-10",
    day: 5,
    start: "11:00",
    end: "12:00",
    summary: "Sábado — control",
    category: "Tratamiento subcutáneo",
  }),
];

const STACK_DAY: CalendarEventDetail[] = [
  eventAt({
    id: "st-1",
    day: 1,
    start: "09:00",
    end: "10:00",
    summary: "Bloque A",
    category: "Test y exámenes",
  }),
  eventAt({
    id: "st-2",
    day: 1,
    start: "09:00",
    end: "10:00",
    summary: "Bloque B",
    category: "Tratamiento subcutáneo",
  }),
  eventAt({
    id: "st-3",
    day: 1,
    start: "09:30",
    end: "10:30",
    summary: "Bloque C",
    category: "Inyección",
  }),
  eventAt({
    id: "st-4",
    day: 1,
    start: "09:30",
    end: "10:30",
    summary: "Bloque D",
    category: "Test y exámenes",
  }),
];

const meta: Meta<typeof WeekGrid> = {
  title: "Calendar/WeekGrid",
  component: WeekGrid,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Grilla semanal Lun-Sáb con eje horario calculado dinámicamente desde los eventos de la semana. Maneja overlaps mediante asignación de columnas (máx 6), colores por categoría y un indicador de hora actual.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="p-4">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof WeekGrid>;

// Empty week: solo se renderiza el horario business default 09:00-20:00.
export const Empty: Story = {
  args: { events: [], weekStart: FIXED_MONDAY },
};

// Light week: 3 eventos repartidos sin overlaps.
export const LightWeek: Story = {
  args: { events: LIGHT_WEEK, weekStart: FIXED_MONDAY },
};

// Busy week: ~10 eventos con overlaps en lunes y jueves.
export const BusyWeek: Story = {
  args: { events: BUSY_WEEK, weekStart: FIXED_MONDAY },
};

// Single day stacked: 4 eventos solapados en martes para exercise layout
// de columnas paralelas.
export const SingleDayStacked: Story = {
  args: { events: STACK_DAY, weekStart: FIXED_MONDAY },
};

// Loading: misma data que LightWeek pero con pointer-events deshabilitado
// y opacidad reducida.
export const Loading: Story = {
  args: { events: LIGHT_WEEK, weekStart: FIXED_MONDAY, loading: true },
};
