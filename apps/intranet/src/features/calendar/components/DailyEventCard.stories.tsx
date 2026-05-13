import type { Meta, StoryObj } from "@storybook/react-vite";
import dayjs from "dayjs";

import type { CalendarEventDetail, EventDteConfirmedLink } from "../types";
import { DailyEventCard } from "./DailyEventCard";

// Stories for the daily-view event card. The component is presentational
// (no queries) but reads `getCalendarEventStates(event)` to build state
// chips, and conditionally renders a DTE link card or "vincular DTE"
// button. Stories cover (a) tratamiento subcutáneo con DTE vinculado,
// (b) test cutáneo con metadata completa, (c) inyección domicilio
// asistida + pagada, (d) evento futuro pendiente de emisión, (e) evento
// cancelado, sin botón de vincular.

const today = dayjs().format("YYYY-MM-DD");
const tomorrow = dayjs().add(1, "day").format("YYYY-MM-DD");
const yesterday = dayjs().subtract(1, "day").format("YYYY-MM-DD");

function buildBase(overrides: Partial<CalendarEventDetail>): CalendarEventDetail {
  return {
    amountExpected: null,
    amountPaid: null,
    attended: null,
    beneficiaryName: null,
    beneficiaryRut: null,
    calendarId: "calendar-bioalergia",
    category: null,
    clinicalSeriesId: null,
    colorId: null,
    controlIncluded: null,
    description: null,
    dosageValue: null,
    dosageUnit: null,
    seriesStageKind: null,
    seriesStageLabel: null,
    seriesStageNumber: null,
    endDate: null,
    endDateTime: null,
    endTimeZone: null,
    eventCreatedAt: null,
    eventDate: today,
    eventDateTime: null,
    eventId: "evt-001",
    eventType: null,
    eventUpdatedAt: null,
    hangoutLink: null,
    isDomicilio: null,
    location: null,
    patientName: null,
    patientRut: null,
    rawEvent: null,
    startDate: null,
    startDateTime: null,
    startTimeZone: null,
    status: "confirmed",
    summary: null,
    testMetadata: null,
    transparency: null,
    treatmentStage: null,
    visibility: "default",
    ...overrides,
  };
}

const SUBCUTANEOUS_EVENT = buildBase({
  eventId: "evt-subc-001",
  summary: "Camila Soto — Inmunoterapia subcutánea vial 4",
  category: "Tratamiento subcutáneo",
  treatmentStage: "Mantención",
  dosageValue: 0.5,
  dosageUnit: "ml",
  seriesStageLabel: "Dosis #18",
  startDateTime: `${yesterday}T13:30:00.000Z`,
  endDateTime: `${yesterday}T13:50:00.000Z`,
  eventDate: yesterday,
  amountExpected: 18_000,
  amountPaid: 18_000,
  attended: true,
});

const DTE_LINK: EventDteConfirmedLink = {
  calendarId: "calendar-bioalergia",
  clientName: "Camila Andrea Soto Vera",
  clientRUT: "16.987.654-3",
  confidenceScore: 92,
  dteSaleDetailId: "dte-555",
  eventId: "evt-subc-001",
  folio: "8842",
  matchedBy: "rut",
  status: "CONFIRMED",
  totalAmount: 18_000,
};

const TEST_EVENT = buildBase({
  eventId: "evt-test-001",
  summary: "Felipe Castillo — Panel inhalantes + parche europeo",
  category: "Test y exámenes",
  testMetadata: {
    skinTest: true,
    patchTest: true,
    firstReading: true,
    secondReading: true,
    thirdReading: false,
  },
  startDateTime: `${today}T14:00:00.000Z`,
  endDateTime: `${today}T15:30:00.000Z`,
  amountExpected: 145_000,
  amountPaid: null,
});

const INJECTION_EVENT = buildBase({
  eventId: "evt-inj-001",
  summary: "Joaquín Reyes — Inyección domicilio Las Condes",
  category: "Inyección",
  controlIncluded: true,
  isDomicilio: true,
  startDateTime: `${today}T18:00:00.000Z`,
  endDateTime: `${today}T18:20:00.000Z`,
  amountExpected: 22_000,
  amountPaid: 22_000,
  attended: true,
  description: "Domicilio Av. Apoquindo 5400, depto 802. Tel: +56 9 8765 4321",
});

const PENDING_EMISSION_EVENT = buildBase({
  eventId: "evt-future-001",
  summary: "Macarena Vidal — Control inmunoterapia",
  category: "Tratamiento subcutáneo",
  treatmentStage: "Inicial",
  startDateTime: `${tomorrow}T10:00:00.000Z`,
  endDateTime: `${tomorrow}T10:30:00.000Z`,
  eventDate: tomorrow,
  amountExpected: 18_000,
});

const CANCELLED_EVENT = buildBase({
  eventId: "evt-cancel-001",
  summary: "Sebastián Rojas — Test cutáneo (cancelado)",
  category: "Test y exámenes",
  status: "cancelled",
  testMetadata: {
    skinTest: true,
    patchTest: false,
    firstReading: false,
    secondReading: false,
    thirdReading: false,
  },
  startDateTime: `${yesterday}T11:00:00.000Z`,
  endDateTime: `${yesterday}T11:30:00.000Z`,
  eventDate: yesterday,
  attended: false,
});

const meta: Meta<typeof DailyEventCard> = {
  title: "Calendar/DailyEventCard",
  component: DailyEventCard,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Tarjeta de un evento del calendario diario. Render presentacional 100%: deriva chips de estado/categoría desde el evento, monto esperado/pagado, indicador de color por categoría y opcional tarjeta de DTE vinculado.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="max-w-3xl">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof DailyEventCard>;

// Tratamiento subcutáneo con DTE confirmado — flujo feliz.
export const SubcutaneousWithDte: Story = {
  args: {
    event: SUBCUTANEOUS_EVENT,
    eventDteLink: DTE_LINK,
    onLinkClick: () => {},
  },
};

// Test y exámenes con metadatos completos: skin + patch + dos lecturas.
export const TestWithMultipleReadings: Story = {
  args: {
    event: TEST_EVENT,
    onLinkClick: () => {},
  },
};

// Inyección a domicilio, pagada y con control incluido.
export const HomeInjectionPaid: Story = {
  args: {
    event: INJECTION_EVENT,
    onLinkClick: () => {},
  },
};

// Evento futuro: aún no se puede vincular DTE (no se ha emitido factura).
export const PendingEmission: Story = {
  args: {
    event: PENDING_EMISSION_EVENT,
    onLinkClick: () => {},
  },
};

// Evento cancelado en Google Calendar — chip de estado en danger.
export const Cancelled: Story = {
  args: {
    event: CANCELLED_EVENT,
    onLinkClick: () => {},
  },
};
