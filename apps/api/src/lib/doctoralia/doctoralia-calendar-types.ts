/**
 * Doctoralia Calendar API TypeScript Types
 *
 * Types for Docplanner Calendar API (docplanner.doctoralia.cl/api/calendarevents)
 */

export interface DoctoraliaCalendarSchedule {
  id: number;
  name: string;
  displayName: string;
  facilityId: number;
  specialityId: number;
  doctorId: number;
  provinceId: number | null;
  cityId: number | null;
  hasWaitingRoom: boolean | null;
  scheduleType: number;
  colorSchemaId: number;
  isVirtual: boolean;
  patientsNotificationType: number;
}

export interface DoctoraliaColorSchema {
  id: number;
  baseColor: string;
  textColor: string;
  eventColor: string;
  iconColor: string;
  backgroundColor: string;
  hoverEventColor: string;
  name: string;
}

export interface DoctoraliaEventService {
  serviceId: number;
  serviceName: string;
  duration: number;
  price: number;
  quantity: number;
  isDefault: boolean;
  voucherUsed: boolean;
}

export interface DoctoraliaAppointment {
  id: number;
  title: string;
  start: string; // ISO8601
  end: string; // ISO8601
  isBlock: boolean;
  eventType: number;
  scheduledBy: number;
  status: number;
  hasPatient: boolean;
  hasWaitingRoom: boolean | null;
  insuranceId: number | null;
  insuranceName: string | null;
  comments: string;
  serviceId: number;
  serviceName: string;
  eventServices: DoctoraliaEventService[];
  eventServicesIds: number[];
  serviceColorSchemaId: number;
  serviceIsDeleted: boolean;
  attendance: number;
  patientId: number;
  patientReferenceId: string;
  patientPhone: string;
  patientEmail: string;
  patientBirthDate: string | null;
  patientArrivalTime: string | null;
  gruppoDefaultDoctor: number | null;
  scheduleId: number;
  colorSchemaId: number | null;
  recurrentSettingsId: number | null;
  roomName: string | null;
  roomId: number | null;
  roomColorSchemaId: number | null;
  isPatientFirstTime: boolean;
  isPatientFirstAdminBooking: boolean;
  isBookedViaSecretaryAi: boolean;
  followUpDateWithSameDoctor: string | null;
  onlinePaymentType: string | null;
  onlinePaymentStatus: string | null;
  isPaidOnline: boolean;
  communicationChannel: string | null;
  fake: boolean;
  isEventWithVoucher: boolean;
  duration: number;
  canNotifyPatient: boolean;
  integrated: {
    hasError: boolean;
    errorMessage: string | null;
    isIntegrated: boolean;
    integrationSetup: number;
  };
  noShowProtection: boolean;
  bnplStatus: string | null;
}

export interface DoctoraliaBlock {
  id: number;
  start: string; // ISO8601
  end: string; // ISO8601
  comments: string | null;
  doctorId: number;
  doctorFullName: string;
  allDay: boolean;
  blockMedicalCenterId: number | null;
  relatedSchedules: number[];
  duration: number;
}

export interface DoctoraliaWorkPeriod {
  scheduleId: number;
  start: string; // ISO8601
  end: string; // ISO8601
  isPrivate: boolean;
}

export interface DoctoraliaResource {
  id: number;
  title: string;
  doctorId: number;
  specialityId: number;
  specialityName: string;
  facilityId: number;
  facilityName: string | null;
  availableDates: Array<{
    date: string;
    time: string;
  }>;
  color: string;
  colorSchemaId: number;
  isVirtual: boolean;
  kind: number;
}

export interface DoctoraliaCalendarResponse {
  countryCode: string;
  schedules: Record<string, DoctoraliaCalendarSchedule>;
  colorSchemas: Record<string, DoctoraliaColorSchema>;
  appointments: DoctoraliaAppointment[];
  blocks: DoctoraliaBlock[];
  holidays: unknown[];
  workperiods: DoctoraliaWorkPeriod[];
  reminders: unknown[];
  resources: DoctoraliaResource[];
}

export interface DoctoraliaCalendarRequest {
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DDTHH:MM:SS
  schedules: number[]; // Empty array = all schedules
}

export type DoctoraliaCalendarAlertType =
  | "new-event-alert"
  | "event-confirmation-alert"
  | "cancel-event-alert"
  | "reschedule-event-alert"
  | string;

export interface DoctoraliaCalendarAlertParams {
  scheduleId?: number;
  eventId?: number;
  oldEventId?: number;
  patientName?: string;
  eventStartDateTime?: string;
  eventStatus?: number;
  patientId?: number;
  cancelledByUserName?: string | null;
  rescheduledByUserName?: string | null;
  createdByUserName?: string | null;
  doctorName?: string;
  external?: boolean;
  externalSource?: string;
  scheduledBy?: number;
  isNotPaidAutomaticCancelation?: boolean;
}

export interface DoctoraliaCalendarAlert {
  id: number;
  triggerUserId: number | null;
  userId: number;
  type: DoctoraliaCalendarAlertType;
  params: DoctoraliaCalendarAlertParams;
  createdAt: string;
  read: boolean;
  readed: boolean;
}
