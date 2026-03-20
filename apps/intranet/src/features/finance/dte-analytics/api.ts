import { dteAnalyticsORPCClient, toDteAnalyticsApiError } from "./orpc";
import type {
  DTEPurchaseDetail,
  DTESalesDetail,
  DTESalesLinkedEventsResponse,
  DTESummaryRaw,
} from "./types";
import {
  DTEPeriodsResponseSchema,
  DTEPurchaseDetailArraySchema,
  DTEPurchaseDetailResponseSchema,
  DTESalesDetailArraySchema,
  DTESalesDetailResponseSchema,
  DTESalesLinkedEventsResponseSchema,
  DTESummaryArraySchema,
  DTESummaryResponseSchema,
} from "./validators";

/**
 * Fetch purchases summary aggregated by period
 * Optionally filtered by year
 * Returns raw DTE summaries with validated period format
 */
export async function fetchPurchasesSummary(year?: number): Promise<DTESummaryRaw[]> {
  try {
    const normalizedYear =
      year !== undefined && Number.isInteger(year) && year >= 2020 && year <= 2030
        ? year
        : undefined;
    const response = DTESummaryResponseSchema.parse(
      await dteAnalyticsORPCClient.purchasesSummary(
        normalizedYear !== undefined ? { year: normalizedYear } : {}
      )
    );

    return DTESummaryArraySchema.parse(response.data);
  } catch (error) {
    throw toDteAnalyticsApiError(error);
  }
}

/**
 * Fetch sales summary aggregated by period
 * Optionally filtered by year
 */
export async function fetchSalesSummary(year?: number): Promise<DTESummaryRaw[]> {
  try {
    const normalizedYear =
      year !== undefined && Number.isInteger(year) && year >= 2020 && year <= 2030
        ? year
        : undefined;
    const response = DTESummaryResponseSchema.parse(
      await dteAnalyticsORPCClient.salesSummary(
        normalizedYear !== undefined ? { year: normalizedYear } : {}
      )
    );

    return DTESummaryArraySchema.parse(response.data);
  } catch (error) {
    throw toDteAnalyticsApiError(error);
  }
}

export interface DTEListParams {
  page?: number;
  pageSize?: number;
  period?: string;
}

export interface DTEListResponse<TItem> {
  data: TItem[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export async function fetchSalesAvailablePeriods(): Promise<string[]> {
  try {
    const response = DTEPeriodsResponseSchema.parse(
      await dteAnalyticsORPCClient.salesAvailablePeriods()
    );
    return DTEPeriodsResponseSchema.shape.data.parse(response.data);
  } catch (error) {
    throw toDteAnalyticsApiError(error);
  }
}

export async function fetchPurchasesAvailablePeriods(): Promise<string[]> {
  try {
    const response = DTEPeriodsResponseSchema.parse(
      await dteAnalyticsORPCClient.purchasesAvailablePeriods()
    );
    return DTEPeriodsResponseSchema.shape.data.parse(response.data);
  } catch (error) {
    throw toDteAnalyticsApiError(error);
  }
}

export async function fetchSalesDetails(
  params: DTEListParams
): Promise<DTEListResponse<DTESalesDetail>> {
  try {
    const response = DTESalesDetailResponseSchema.parse(
      await dteAnalyticsORPCClient.salesDetails({
        page: params.page ?? 1,
        pageSize: params.pageSize ?? 50,
        period: params.period,
      })
    );

    return {
      data: DTESalesDetailArraySchema.parse(response.data),
      meta: DTESalesDetailResponseSchema.shape.meta.parse(response.meta),
    };
  } catch (error) {
    throw toDteAnalyticsApiError(error);
  }
}

export async function fetchSalesLinkedEvents(
  dteSaleDetailId: string
): Promise<DTESalesLinkedEventsResponse> {
  try {
    const response = DTESalesLinkedEventsResponseSchema.parse(
      await dteAnalyticsORPCClient.salesLinkedEvents({ dteSaleDetailId })
    );
    return response.data;
  } catch (error) {
    throw toDteAnalyticsApiError(error);
  }
}

export async function fetchPurchasesDetails(
  params: DTEListParams
): Promise<DTEListResponse<DTEPurchaseDetail>> {
  try {
    const response = DTEPurchaseDetailResponseSchema.parse(
      await dteAnalyticsORPCClient.purchasesDetails({
        page: params.page ?? 1,
        pageSize: params.pageSize ?? 50,
        period: params.period,
      })
    );

    return {
      data: DTEPurchaseDetailArraySchema.parse(response.data),
      meta: DTEPurchaseDetailResponseSchema.shape.meta.parse(response.meta),
    };
  } catch (error) {
    throw toDteAnalyticsApiError(error);
  }
}
