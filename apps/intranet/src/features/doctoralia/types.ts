/**
 * Doctoralia Frontend Types
 *
 * TypeScript interfaces for Doctoralia data (camelCase for frontend).
 */

export interface DoctoraliaEventService {
  duration: number;
  isDefault?: boolean;
  price: number;
  quantity: number;
  serviceId: number;
  serviceName: string;
  voucherUsed?: boolean;
}

export interface DoctoraliaCalendarAppointment {
  colorSchemaId: null | number;
  comments: null | string;
  duration: number;
  endAt: Date;
  eventServices: { items: DoctoraliaEventService[] } | null;
  eventType: number;
  externalId: number;
  hasPatient: boolean;
  id: number;
  isPatientFirstAdminBooking: boolean;
  isPatientFirstTime: boolean;
  patientBirthDate: Date | null;
  patientExternalId: number;
  patientReferenceId: string;
  schedule: {
    displayName: string;
    externalId: number;
  };
  scheduledBy: number;
  serviceColorSchemaId: null | number;
  serviceName: string;
  startAt: Date;
  status: number;
  title: string;
}

export interface DoctoraliaCalendarAppointmentsResponse {
  data: {
    appointments: DoctoraliaCalendarAppointment[];
    count: number;
    filters: {
      from: string;
      scheduleIds: number[];
      to: string;
    };
  };
  status: "ok";
}

export interface DoctoraliaMergedCalendarEntry {
  appointment: DoctoraliaCalendarAppointment;
  emails: {
    all: DoctoraliaEmailNotification[];
    booking: DoctoraliaEmailNotification | null;
    cancellation: DoctoraliaEmailNotification | null;
    modifications: DoctoraliaEmailNotification[];
  };
}

export interface DoctoraliaCalendarMerged {
  counts: {
    appointments: number;
    matchedEmails: number;
    orphanEmails: number;
  };
  entries: DoctoraliaMergedCalendarEntry[];
  orphanEmails: DoctoraliaEmailNotification[];
}

export interface DoctoraliaCalendarBackfillBucketCounts {
  inserted: number;
  updated: number;
  skipped: number;
}

export interface DoctoraliaCalendarBackfillStatus {
  running: boolean;
  cancelRequested: boolean;
  startedAt: string | null;
  endedAt: string | null;
  targetEndDate: string | null;
  triggeredByUserId: number | null;
  weeksTotal: number;
  weeksProcessed: number;
  weeksFailed: number;
  schedules: DoctoraliaCalendarBackfillBucketCounts;
  appointments: DoctoraliaCalendarBackfillBucketCounts;
  workPeriods: DoctoraliaCalendarBackfillBucketCounts;
  currentWindow: { from: string; to: string } | null;
  lastError: string | null;
  minEndDate: string;
}

export interface DoctoraliaSyncLog {
  counts: Record<string, number>;
  endedAt: null | Date;
  errorMessage: null | string;
  id: number;
  startedAt: Date;
  status: string;
  syncType: "CALENDAR" | "EMAIL";
  triggerSource: null | string;
  triggerUserId: null | number;
}

export interface DoctoraliaSyncLogsResponse {
  logs: DoctoraliaSyncLog[];
  status: "ok";
}

export interface DoctoraliaCalendarAppointmentsQuery {
  from: string;
  scheduleIds?: number[];
  to: string;
}

export interface DoctoraliaEmailNotification {
  appointmentDate: Date | null;
  appointmentDoctor: string | null;
  appointmentService: string | null;
  calendarAppointmentId: number | null;
  clinicAddress: string | null;
  createdAt: Date;
  emailMessageId: string;
  eventType: "BOOKING" | "CANCELLATION" | "MODIFICATION";
  id: string;
  patientEmail: string | null;
  patientName: string;
  patientPhone: string | null;
  previousAppointmentDate: Date | null;
  updatedAt: Date;
}

export interface DoctoraliaEmailPatient {
  lastAppointmentDate: Date | null;
  patientEmail: string | null;
  patientName: string;
  patientPhone: string | null;
  totalBookings: number;
}

export interface DoctoraliaEmailListener {
  enabled: boolean;
  host: string | null;
  lastConnectedAt: Date | null;
  lastErrorAt: Date | null;
  lastErrorMessage: string | null;
  lastProcessedAt: Date | null;
  lastStartedAt: Date | null;
  mailbox: string | null;
  reconnectDelayMs: number | null;
  state: "stopped" | "missing_config" | "connecting" | "connected" | "error";
  user: string | null;
}

export interface DoctoraliaEmailOverview {
  imapHostConfigured: boolean;
  imapMailbox: string;
  imapPassConfigured: boolean;
  imapReady: boolean;
  imapUserConfigured: boolean;
  listener: DoctoraliaEmailListener;
  senderFilter: string;
}

export interface DoctoraliaEmailStats {
  bookings: number;
  cancellations: number;
  modifications: number;
  total: number;
  withPhone: number;
}

export interface DoctoraliaEmailMonthlySummaryPeriod {
  period: string;
  bookings: number;
  modifications: number;
  cancellations: number;
  total: number;
  cancellationRate: number;
}

export interface DoctoraliaCalendarMonthlySummaryPeriod {
  period: string;
  programmed: number;
  cancelled: number;
  attended: number;
  total: number;
  cancellationRate: number;
}

export interface DoctoraliaEmailListResponse {
  notifications: DoctoraliaEmailNotification[];
  total: number;
}

export interface DoctoraliaEmailIngestResponse {
  data: {
    alreadyProcessed: number;
    checked: number;
    failed: number;
    saved: number;
    skipped: number;
  };
  message: string;
  status: "ok" | "error";
}

export interface DoctoraliaScraperRunOverrideStatus {
  active: boolean;
  expiresAt: Date | null;
  requestedAt: Date | null;
  requestedByEmail: string | null;
  requestedByUserId: number | null;
}
