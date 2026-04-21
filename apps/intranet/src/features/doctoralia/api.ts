/**
 * Doctoralia API Client
 *
 * Frontend API functions for Doctoralia integration.
 */

import { doctoraliaORPCClient, toDoctoraliaApiError } from "./orpc";
import {
  DoctoraliaCalendarAppointmentsResponseSchema,
  DoctoraliaCalendarBackfillStatusResponseSchema,
  DoctoraliaCalendarMergedResponseSchema,
  DoctoraliaCalendarMonthlySummaryResponseSchema,
  DoctoraliaEmailMonthlySummaryResponseSchema,
  DoctoraliaEmailNotificationsCalendarResponseSchema,
  DoctoraliaEmailNotificationsListResponseSchema,
  DoctoraliaEmailOverviewResponseSchema,
  DoctoraliaEmailPatientHistoryResponseSchema,
  DoctoraliaEmailPatientsResponseSchema,
  DoctoraliaEmailStatsResponseSchema,
  DoctoraliaEmailIngestResponseSchema,
  DoctoraliaScraperCookiesStatusResponseSchema,
  DoctoraliaSyncLogsResponseSchema,
  DoctoraliaUpdateScraperCookiesResponseSchema,
} from "./schemas";
import type {
  DoctoraliaCalendarAppointment,
  DoctoraliaCalendarAppointmentsQuery,
  DoctoraliaCalendarAppointmentsResponse,
  DoctoraliaCalendarBackfillStatus,
  DoctoraliaCalendarMerged,
  DoctoraliaCalendarMonthlySummaryPeriod,
  DoctoraliaEmailMonthlySummaryPeriod,
  DoctoraliaEmailNotification,
  DoctoraliaEmailListResponse,
  DoctoraliaEmailOverview,
  DoctoraliaEmailPatient,
  DoctoraliaEmailIngestResponse,
  DoctoraliaEmailStats,
  DoctoraliaSyncLog,
  DoctoraliaSyncLogsResponse,
} from "./types";

export async function fetchDoctoraliaCalendarAppointments(
  query: DoctoraliaCalendarAppointmentsQuery
): Promise<DoctoraliaCalendarAppointment[]> {
  let response: DoctoraliaCalendarAppointmentsResponse;
  try {
    response = DoctoraliaCalendarAppointmentsResponseSchema.parse(
      await doctoraliaORPCClient.calendarAppointments({
        from: query.from,
        to: query.to,
        scheduleIds: query.scheduleIds?.length ? query.scheduleIds : undefined,
      })
    );
  } catch (error) {
    throw toDoctoraliaApiError(error);
  }

  if (response.status !== "ok") {
    throw new Error("No se pudo obtener las citas de Doctoralia");
  }

  return response.data.appointments;
}

export async function fetchDoctoraliaCalendarMerged(query: {
  from: string;
  to: string;
}): Promise<DoctoraliaCalendarMerged> {
  let response;
  try {
    response = DoctoraliaCalendarMergedResponseSchema.parse(
      await doctoraliaORPCClient.calendarMerged({ from: query.from, to: query.to })
    );
  } catch (error) {
    throw toDoctoraliaApiError(error);
  }

  if (response.status !== "ok") {
    throw new Error("No se pudo obtener el calendario unificado de Doctoralia");
  }

  return response.data;
}

export async function fetchDoctoraliaBackfillStatus(): Promise<DoctoraliaCalendarBackfillStatus> {
  try {
    const response = DoctoraliaCalendarBackfillStatusResponseSchema.parse(
      await doctoraliaORPCClient.calendarBackfillStatus()
    );
    return response.data;
  } catch (error) {
    throw toDoctoraliaApiError(error);
  }
}

export async function startDoctoraliaCalendarBackfill(input: {
  endDate: string;
}): Promise<DoctoraliaCalendarBackfillStatus> {
  try {
    const response = DoctoraliaCalendarBackfillStatusResponseSchema.parse(
      await doctoraliaORPCClient.calendarBackfillStart({ endDate: input.endDate })
    );
    return response.data;
  } catch (error) {
    throw toDoctoraliaApiError(error);
  }
}

export async function cancelDoctoraliaCalendarBackfill(): Promise<DoctoraliaCalendarBackfillStatus> {
  try {
    const response = DoctoraliaCalendarBackfillStatusResponseSchema.parse(
      await doctoraliaORPCClient.calendarBackfillCancel()
    );
    return response.data;
  } catch (error) {
    throw toDoctoraliaApiError(error);
  }
}

export async function fetchDoctoraliaSyncLogs(): Promise<DoctoraliaSyncLog[]> {
  let response: DoctoraliaSyncLogsResponse;
  try {
    response = DoctoraliaSyncLogsResponseSchema.parse(await doctoraliaORPCClient.syncLogs());
  } catch (error) {
    throw toDoctoraliaApiError(error);
  }

  if (response.status !== "ok") {
    throw new Error("No se pudo obtener los logs de sincronización");
  }

  return response.logs;
}

export async function fetchDoctoraliaEmailCalendar(query: {
  from: string;
  to: string;
}): Promise<DoctoraliaEmailNotification[]> {
  let response;
  try {
    response = DoctoraliaEmailNotificationsCalendarResponseSchema.parse(
      await doctoraliaORPCClient.emailNotificationsCalendar(query)
    );
  } catch (error) {
    throw toDoctoraliaApiError(error);
  }

  if (response.status !== "ok") {
    throw new Error("No se pudo obtener las notificaciones de email de Doctoralia");
  }

  return response.data.notifications;
}

export async function fetchDoctoraliaEmailOverview(): Promise<DoctoraliaEmailOverview> {
  let response;
  try {
    response = DoctoraliaEmailOverviewResponseSchema.parse(
      await doctoraliaORPCClient.emailNotificationsOverview()
    );
  } catch (error) {
    throw toDoctoraliaApiError(error);
  }

  return response.data;
}

export async function fetchDoctoraliaEmailNotifications(params: {
  limit?: number;
  offset?: number;
}): Promise<DoctoraliaEmailListResponse> {
  let response;
  try {
    response = DoctoraliaEmailNotificationsListResponseSchema.parse(
      await doctoraliaORPCClient.emailNotificationsList(params)
    );
  } catch (error) {
    throw toDoctoraliaApiError(error);
  }

  return response.data;
}

export async function fetchDoctoraliaEmailStats(): Promise<DoctoraliaEmailStats> {
  let response;
  try {
    response = DoctoraliaEmailStatsResponseSchema.parse(
      await doctoraliaORPCClient.emailNotificationsStats()
    );
  } catch (error) {
    throw toDoctoraliaApiError(error);
  }

  return response.data;
}

export async function fetchDoctoraliaEmailMonthlySummary(
  year?: number
): Promise<DoctoraliaEmailMonthlySummaryPeriod[]> {
  let response;
  try {
    response = DoctoraliaEmailMonthlySummaryResponseSchema.parse(
      await doctoraliaORPCClient.emailNotificationsMonthlySummary(
        year !== undefined ? { year } : {}
      )
    );
  } catch (error) {
    throw toDoctoraliaApiError(error);
  }

  if (response.status !== "ok") {
    throw new Error("No se pudo obtener el resumen mensual de Doctoralia");
  }

  return response.data;
}

export async function fetchDoctoraliaCalendarMonthlySummary(
  year?: number
): Promise<DoctoraliaCalendarMonthlySummaryPeriod[]> {
  let response;
  try {
    response = DoctoraliaCalendarMonthlySummaryResponseSchema.parse(
      await doctoraliaORPCClient.calendarAppointmentsMonthlySummary(
        year !== undefined ? { year } : {}
      )
    );
  } catch (error) {
    throw toDoctoraliaApiError(error);
  }

  if (response.status !== "ok") {
    throw new Error("No se pudo obtener el resumen mensual de calendario de Doctoralia");
  }

  return response.data;
}

export async function triggerDoctoraliaEmailIngest(): Promise<DoctoraliaEmailIngestResponse> {
  try {
    return DoctoraliaEmailIngestResponseSchema.parse(
      await doctoraliaORPCClient.emailNotificationsIngest({})
    );
  } catch (error) {
    throw toDoctoraliaApiError(error);
  }
}

export async function fetchDoctoraliaEmailPatients(query?: {
  search?: string;
}): Promise<DoctoraliaEmailPatient[]> {
  let response;
  try {
    response = DoctoraliaEmailPatientsResponseSchema.parse(
      await doctoraliaORPCClient.emailNotificationsPatients(query ?? {})
    );
  } catch (error) {
    throw toDoctoraliaApiError(error);
  }

  if (response.status !== "ok") {
    throw new Error("No se pudo obtener los pacientes de Doctoralia");
  }

  return response.data.patients;
}

export async function fetchDoctoraliaEmailPatientHistory(query: {
  patientName: string;
  patientPhone?: string | null;
}): Promise<DoctoraliaEmailNotification[]> {
  let response;
  try {
    response = DoctoraliaEmailPatientHistoryResponseSchema.parse(
      await doctoraliaORPCClient.emailNotificationsPatientHistory(query)
    );
  } catch (error) {
    throw toDoctoraliaApiError(error);
  }

  if (response.status !== "ok") {
    throw new Error("No se pudo obtener el historial del paciente");
  }

  return response.data.notifications;
}

export type DoctoraliaScraperCookiesStatus = {
  exists: boolean;
  label: string | null;
  count: number;
  updatedAt: Date | null;
  lastUsedAt: Date | null;
  updatedByUserId: number | null;
  updatedByEmail: string | null;
};

export async function fetchDoctoraliaScraperCookiesStatus(): Promise<DoctoraliaScraperCookiesStatus> {
  try {
    const response = DoctoraliaScraperCookiesStatusResponseSchema.parse(
      await doctoraliaORPCClient.scraperCookiesStatus()
    );
    return response.data;
  } catch (error) {
    throw toDoctoraliaApiError(error);
  }
}

export async function updateDoctoraliaScraperCookies(input: {
  cookieHeader: string;
  label?: string;
}): Promise<{ label: string; count: number; updatedAt: Date }> {
  try {
    const response = DoctoraliaUpdateScraperCookiesResponseSchema.parse(
      await doctoraliaORPCClient.updateScraperCookies({
        cookieHeader: input.cookieHeader,
        label: input.label,
      })
    );
    return response.data;
  } catch (error) {
    throw toDoctoraliaApiError(error);
  }
}
