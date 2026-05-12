import { formatISO } from "@/lib/dates";
import {
  type ServiceDetailTransport,
  type ServiceListTransport,
  type ServiceScheduleItemTransport,
  type ServiceScheduleTransport,
  servicesORPCClient,
  toServicesApiError,
} from "./orpc";

import type {
  CreateServicePayload,
  RegenerateServicePayload,
  ServiceDetailResponse,
  ServiceListResponse,
  ServicePaymentPayload,
  ServiceSchedule,
  ServiceScheduleEditPayload,
  ServiceScheduleSkipPayload,
  ServiceSyncTransactionsResult,
} from "./types";

type CreateServicePayloadRequest = Omit<CreateServicePayload, "emissionExactDate" | "startDate"> & {
  emissionExactDate?: null | string;
  startDate: string;
};

type RegenerateServicePayloadRequest = Omit<RegenerateServicePayload, "startDate"> & {
  startDate?: string;
};

type ServicePaymentPayloadRequest = Omit<ServicePaymentPayload, "paidDate"> & { paidDate: string };

type ServiceScheduleEditPayloadRequest = Omit<ServiceScheduleEditPayload, "dueDate"> & {
  dueDate?: string;
};

function serializeServicePayload(payload: CreateServicePayload): CreateServicePayloadRequest {
  return {
    ...payload,
    emissionExactDate: payload.emissionExactDate ? formatISO(payload.emissionExactDate) : null,
    startDate: formatISO(payload.startDate),
  };
}

function serializeRegeneratePayload(
  payload: RegenerateServicePayload
): RegenerateServicePayloadRequest {
  return {
    ...payload,
    startDate: payload.startDate ? formatISO(payload.startDate) : undefined,
  };
}

function serializePaymentPayload(payload: ServicePaymentPayload): ServicePaymentPayloadRequest {
  return {
    ...payload,
    paidDate: formatISO(payload.paidDate),
  };
}

function serializeScheduleEditPayload(
  payload: ServiceScheduleEditPayload
): ServiceScheduleEditPayloadRequest {
  return {
    ...payload,
    dueDate: payload.dueDate ? formatISO(payload.dueDate) : undefined,
  };
}

export async function createService(payload: CreateServicePayload): Promise<ServiceDetailResponse> {
  try {
    return normalizeDetailResponse(
      await servicesORPCClient.create(serializeServicePayload(payload))
    );
  } catch (error) {
    throw toServicesApiError(error);
  }
}

export function extractErrorMessage(error: unknown): null | string {
  if (!error) {
    return null;
  }
  return error instanceof Error ? error.message : JSON.stringify(error);
}

export async function fetchServiceDetail(publicId: string): Promise<ServiceDetailResponse> {
  try {
    return normalizeDetailResponse(await servicesORPCClient.detail({ id: publicId }));
  } catch (error) {
    throw toServicesApiError(error);
  }
}

export async function fetchServices(): Promise<ServiceListResponse> {
  try {
    return normalizeListResponse(await servicesORPCClient.list());
  } catch (error) {
    throw toServicesApiError(error);
  }
}

export async function regenerateServiceSchedules(
  publicId: string,
  payload: RegenerateServicePayload
): Promise<ServiceDetailResponse> {
  try {
    return normalizeDetailResponse(
      await servicesORPCClient.regenerateSchedules({
        id: publicId,
        ...serializeRegeneratePayload(payload),
      })
    );
  } catch (error) {
    throw toServicesApiError(error);
  }
}

export async function registerServicePayment(
  scheduleId: number,
  payload: ServicePaymentPayload
): Promise<{ schedule: ServiceSchedule; status: "ok" }> {
  try {
    return normalizeScheduleResponse(
      await servicesORPCClient.schedulePay({ id: scheduleId, ...serializePaymentPayload(payload) })
    );
  } catch (error) {
    throw toServicesApiError(error);
  }
}

export async function unlinkServicePayment(
  scheduleId: number
): Promise<{ schedule: ServiceSchedule; status: "ok" }> {
  try {
    return normalizeScheduleResponse(await servicesORPCClient.scheduleUnlink({ id: scheduleId }));
  } catch (error) {
    throw toServicesApiError(error);
  }
}

export async function editServiceSchedule(
  scheduleId: number,
  payload: ServiceScheduleEditPayload
): Promise<{ schedule: ServiceSchedule; status: "ok" }> {
  try {
    return normalizeScheduleResponse(
      await servicesORPCClient.scheduleEdit({
        id: scheduleId,
        ...serializeScheduleEditPayload(payload),
      })
    );
  } catch (error) {
    throw toServicesApiError(error);
  }
}

export async function skipServiceSchedule(
  scheduleId: number,
  payload: ServiceScheduleSkipPayload
): Promise<{ schedule: ServiceSchedule; status: "ok" }> {
  try {
    return normalizeScheduleResponse(
      await servicesORPCClient.scheduleSkip({ id: scheduleId, ...payload })
    );
  } catch (error) {
    throw toServicesApiError(error);
  }
}

export async function updateService(
  publicId: string,
  payload: CreateServicePayload
): Promise<ServiceDetailResponse> {
  try {
    return normalizeDetailResponse(
      await servicesORPCClient.update({ id: publicId, payload: serializeServicePayload(payload) })
    );
  } catch (error) {
    throw toServicesApiError(error);
  }
}

export async function syncAllServiceTransactions(): Promise<ServiceSyncTransactionsResult> {
  try {
    const result = await servicesORPCClient.syncAllTransactions();
    return result.data;
  } catch (error) {
    throw toServicesApiError(error);
  }
}

export async function syncServiceTransactions(
  publicId: string
): Promise<ServiceSyncTransactionsResult> {
  try {
    const result = await servicesORPCClient.syncTransactions({ id: publicId });
    return result.data;
  } catch (error) {
    throw toServicesApiError(error);
  }
}

function toNumberValue(value: null | number | string | { toNumber: () => number } | undefined) {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return value.toNumber();
}

function normalizeSchedule(schedule: ServiceScheduleItemTransport): ServiceSchedule {
  return {
    createdAt: schedule.createdAt,
    dueDate: schedule.dueDate,
    effectiveAmount: toNumberValue(schedule.effectiveAmount) ?? 0,
    expectedAmount: toNumberValue(schedule.expectedAmount) ?? 0,
    financialTransactionId: schedule.financialTransactionId ?? null,
    id: schedule.id,
    lateFeeAmount: toNumberValue(schedule.lateFeeAmount) ?? 0,
    note: schedule.note,
    overdueDays: schedule.overdueDays,
    paidAmount: (toNumberValue(schedule.paidAmount) ?? null) as number | null,
    paidDate: schedule.paidDate ?? null,
    periodEnd: schedule.periodEnd,
    periodStart: schedule.periodStart,
    serviceId: schedule.serviceId,
    status: schedule.status,
    transaction: schedule.transaction
      ? {
          ...schedule.transaction,
          amount: (toNumberValue(schedule.transaction.amount) ?? null) as number | null,
          description: schedule.transaction.description ?? null,
          timestamp: schedule.transaction.timestamp ?? new Date(0),
        }
      : null,
    transactionId: schedule.transactionId ?? null,
    updatedAt: schedule.updatedAt,
  };
}

function normalizeService(
  service: ServiceDetailTransport["service"]
): ServiceDetailResponse["service"] {
  return {
    ...service,
    defaultAmount: toNumberValue(service.defaultAmount) ?? 0,
    lateFeeValue: (toNumberValue(service.lateFeeValue) ?? null) as number | null,
    totalExpected: toNumberValue(service.totalExpected) ?? 0,
    totalPaid: toNumberValue(service.totalPaid) ?? 0,
  };
}

function normalizeDetailResponse(response: ServiceDetailTransport): ServiceDetailResponse {
  return {
    ...response,
    schedules: response.schedules.map(normalizeSchedule),
    service: normalizeService(response.service),
  };
}

function normalizeListResponse(response: ServiceListTransport): ServiceListResponse {
  return {
    ...response,
    services: response.services.map(normalizeService),
  };
}

function normalizeScheduleResponse(response: ServiceScheduleTransport): {
  schedule: ServiceSchedule;
  status: "ok";
} {
  return {
    ...response,
    schedule: normalizeSchedule(response.schedule),
  };
}
