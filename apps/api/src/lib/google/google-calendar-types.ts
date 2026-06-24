import type { calendar_v3 } from "@googleapis/calendar";

export type CalendarEventRecord = {
  calendarId: string;
  eventId: string;
  status?: string | null;
  eventType?: string | null;
  summary?: string | null;
  description?: string | null;
  start?: calendar_v3.Schema$EventDateTime | null;
  end?: calendar_v3.Schema$EventDateTime | null;
  created?: string | null;
  updated?: string | null;
  colorId?: string | null;
  location?: string | null;
  transparency?: string | null;
  visibility?: string | null;
  hangoutLink?: string | null;
  category?: string | null;
  amountExpected?: number | null;
  amountPaid?: number | null;
  attended?: boolean | null;
  clinicalSeriesKind?:
    | "PATCH_TEST"
    | "SKIN_TEST"
    | "SUBCUTANEOUS_TREATMENT"
    | "MEDICAL_CONSULTATION"
    | null;
  seriesStageKind?: "DOSE" | "INSTALLATION" | "MAINTENANCE" | "READING" | null;
  seriesStageLabel?: string | null;
  seriesStageNumber?: number | null;
  dosageValue?: number | null;
  dosageUnit?: string | null;
  treatmentStage?: string | null;
  controlIncluded?: boolean | null;
  isDomicilio?: boolean | null;
  testMetadata?: {
    firstReading: boolean;
    patchTest: boolean;
    secondReading: boolean;
    skinTest: boolean;
    thirdReading: boolean;
  } | null;
};
