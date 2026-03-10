import { z } from "zod";
import { formatISO } from "@/lib/dates";
import { servicesORPCClient, toServicesApiError } from "./orpc";

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

const ServiceDetailResponseSchema = z.looseObject({});
const ServiceListResponseSchema = z.looseObject({});
const ServiceScheduleResponseSchema = z.object({
  schedule: z.unknown(),
  status: z.literal("ok"),
});
const ServiceSyncResponseSchema = z.object({
  data: z.object({
    matchedSchedules: z.number(),
    processedSchedules: z.number(),
    scannedTransactions: z.number(),
    servicesCount: z.number(),
  }),
  status: z.literal("ok"),
});

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
  payload: RegenerateServicePayload,
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
  payload: ServiceScheduleEditPayload,
): ServiceScheduleEditPayloadRequest {
  return {
    ...payload,
    dueDate: payload.dueDate ? formatISO(payload.dueDate) : undefined,
  };
}

export async function createService(payload: CreateServicePayload): Promise<ServiceDetailResponse> {
  try {
    return ServiceDetailResponseSchema.parse(
      normalizeDetailResponse(await servicesORPCClient.create(serializeServicePayload(payload))),
    ) as unknown as ServiceDetailResponse;
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
    return ServiceDetailResponseSchema.parse(
      normalizeDetailResponse(await servicesORPCClient.detail({ id: publicId })),
    ) as unknown as ServiceDetailResponse;
  } catch (error) {
    throw toServicesApiError(error);
  }
}

export async function fetchServices(): Promise<ServiceListResponse> {
  try {
    return ServiceListResponseSchema.parse(
      normalizeListResponse(await servicesORPCClient.list()),
    ) as unknown as ServiceListResponse;
  } catch (error) {
    throw toServicesApiError(error);
  }
}

export async function regenerateServiceSchedules(
  publicId: string,
  payload: RegenerateServicePayload,
): Promise<ServiceDetailResponse> {
  try {
    return ServiceDetailResponseSchema.parse(
      normalizeDetailResponse(
        await servicesORPCClient.regenerateSchedules({
          id: publicId,
          ...serializeRegeneratePayload(payload),
        }),
      ),
    ) as unknown as ServiceDetailResponse;
  } catch (error) {
    throw toServicesApiError(error);
  }
}

export async function registerServicePayment(
  scheduleId: number,
  payload: ServicePaymentPayload,
): Promise<{ schedule: ServiceSchedule; status: "ok" }> {
  try {
    return ServiceScheduleResponseSchema.parse(
      normalizeScheduleResponse(
        await servicesORPCClient.schedulePay({
          id: scheduleId,
          ...serializePaymentPayload(payload),
        }),
      ),
    ) as unknown as { schedule: ServiceSchedule; status: "ok" };
  } catch (error) {
    throw toServicesApiError(error);
  }
}

export async function unlinkServicePayment(
  scheduleId: number,
): Promise<{ schedule: ServiceSchedule; status: "ok" }> {
  try {
    return ServiceScheduleResponseSchema.parse(
      normalizeScheduleResponse(await servicesORPCClient.scheduleUnlink({ id: scheduleId })),
    ) as unknown as { schedule: ServiceSchedule; status: "ok" };
  } catch (error) {
    throw toServicesApiError(error);
  }
}

export async function editServiceSchedule(
  scheduleId: number,
  payload: ServiceScheduleEditPayload,
): Promise<{ schedule: ServiceSchedule; status: "ok" }> {
  try {
    return ServiceScheduleResponseSchema.parse(
      normalizeScheduleResponse(
        await servicesORPCClient.scheduleEdit({
          id: scheduleId,
          ...serializeScheduleEditPayload(payload),
        }),
      ),
    ) as unknown as { schedule: ServiceSchedule; status: "ok" };
  } catch (error) {
    throw toServicesApiError(error);
  }
}

export async function skipServiceSchedule(
  scheduleId: number,
  payload: ServiceScheduleSkipPayload,
): Promise<{ schedule: ServiceSchedule; status: "ok" }> {
  try {
    return ServiceScheduleResponseSchema.parse(
      normalizeScheduleResponse(
        await servicesORPCClient.scheduleSkip({
          id: scheduleId,
          ...payload,
        }),
      ),
    ) as unknown as { schedule: ServiceSchedule; status: "ok" };
  } catch (error) {
    throw toServicesApiError(error);
  }
}

export async function updateService(
  publicId: string,
  payload: CreateServicePayload,
): Promise<ServiceDetailResponse> {
  try {
    return ServiceDetailResponseSchema.parse(
      normalizeDetailResponse(
        await servicesORPCClient.update({
          id: publicId,
          payload: serializeServicePayload(payload),
        }),
      ),
    ) as unknown as ServiceDetailResponse;
  } catch (error) {
    throw toServicesApiError(error);
  }
}

export async function syncAllServiceTransactions(): Promise<ServiceSyncTransactionsResult> {
  try {
    const response = ServiceSyncResponseSchema.parse(
      await servicesORPCClient.syncAllTransactions(),
    );
    return response.data;
  } catch (error) {
    throw toServicesApiError(error);
  }
}

export async function syncServiceTransactions(
  publicId: string,
): Promise<ServiceSyncTransactionsResult> {
  try {
    const response = ServiceSyncResponseSchema.parse(
      await servicesORPCClient.syncTransactions({ id: publicId }),
    );
    return response.data;
  } catch (error) {
    throw toServicesApiError(error);
  }
}

function toNumberValue(value: null | number | { toNumber: () => number } | undefined) {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "number") {
    return value;
  }

  return value.toNumber();
}

function normalizeSchedule(schedule: ServiceSchedule): ServiceSchedule {
  return {
    ...schedule,
    effectiveAmount: toNumberValue(schedule.effectiveAmount) ?? 0,
    expectedAmount: toNumberValue(schedule.expectedAmount) ?? 0,
    lateFeeAmount: toNumberValue(schedule.lateFeeAmount) ?? 0,
    paidAmount: (toNumberValue(schedule.paidAmount) ?? null) as number | null,
    transaction: schedule.transaction
      ? {
          ...schedule.transaction,
          amount: (toNumberValue(schedule.transaction.amount) ?? null) as number | null,
        }
      : schedule.transaction,
  };
}

function normalizeService(
  service: ServiceDetailResponse["service"],
): ServiceDetailResponse["service"] {
  return {
    ...service,
    defaultAmount: toNumberValue(service.defaultAmount) ?? 0,
    lateFeeValue: (toNumberValue(service.lateFeeValue) ?? null) as number | null,
    totalExpected: toNumberValue(service.totalExpected) ?? 0,
    totalPaid: toNumberValue(service.totalPaid) ?? 0,
  };
}

function normalizeDetailResponse(response: ServiceDetailResponse): ServiceDetailResponse {
  return {
    ...response,
    schedules: response.schedules.map(normalizeSchedule),
    service: normalizeService(response.service),
  };
}

function normalizeListResponse(response: ServiceListResponse): ServiceListResponse {
  return {
    ...response,
    services: response.services.map(normalizeService),
  };
}

function normalizeScheduleResponse(response: { schedule: ServiceSchedule; status: "ok" }): {
  schedule: ServiceSchedule;
  status: "ok";
} {
  return {
    ...response,
    schedule: normalizeSchedule(response.schedule),
  };
}
