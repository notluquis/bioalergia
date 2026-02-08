/**
 * Download CSV from Haulmer API
 */

import { GaxiosError, request } from "gaxios";

export async function downloadHaulmerCSV(
  rut: string,
  period: string,
  docType: "sales" | "purchases",
  jwtToken: string,
  workspaceId?: string,
): Promise<string> {
  const docTypeSegment = docType === "sales" ? "ventas" : "compras";
  const url = `https://api-frontend.haulmer.com/v3/dte/core/registro/${docTypeSegment}/detalle/${rut}/periodo/${period}/csv`;

  console.log(`[Haulmer Download] Fetching ${docType} for ${period}`);

  const headers: Record<string, string> = {
    Authorization: `Bearer ${jwtToken}`,
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15",
    Origin: "https://espacio.haulmer.com",
    Referer: "https://espacio.haulmer.com/",
  };

  if (workspaceId) {
    headers.workspace = workspaceId;
    headers.resource = workspaceId;
  }

  try {
    const response = await request<string>({
      url,
      method: "GET",
      headers,
      timeout: 30000,
    });

    if (response.status !== 200) {
      throw new Error(`HTTP ${response.status}`);
    }

    if (!response.data || typeof response.data !== "string") {
      throw new Error("Invalid response: not CSV text");
    }

    console.log(`[Haulmer Download] Success for ${docType} - ${period}`);
    return response.data;
  } catch (error) {
    if (error instanceof GaxiosError) {
      const status = error.response?.status;
      if (status === 401) {
        throw new Error("UNAUTHORIZED: JWT expired or invalid");
      }
      if (status === 404) {
        throw new Error("NOT_FOUND: Period/RUT combination not found");
      }
      throw new Error(`HTTP Error: ${status || error.code}`);
    }
    throw error;
  }
}

/**
 * Fetch available sales periods for RUT
 */
export async function fetchAvailableSalesPeriods(
  rut: string,
  jwtToken: string,
  workspaceId?: string,
): Promise<string[]> {
  const url = `https://api-frontend.haulmer.com/v3/dte/core/registro/ventas/periodos/${rut}`;

  console.log(`[Haulmer] Fetching available sales periods for ${rut}`);

  const headers: Record<string, string> = {
    Authorization: `Bearer ${jwtToken}`,
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15",
    Origin: "https://espacio.haulmer.com",
    Referer: "https://espacio.haulmer.com/",
  };

  if (workspaceId) {
    headers.workspace = workspaceId;
    headers.resource = workspaceId;
  }

  try {
    const response = await request<{
      message: string | null;
      code: string;
      details?: Array<{ periodo: number; emitidos: number }>;
    }>({
      url,
      method: "GET",
      headers,
      timeout: 30000,
    });

    if (response.status !== 200) {
      throw new Error(`HTTP ${response.status}`);
    }

    // API returns { code: "OF-OK", details: [{ periodo: 202602, emitidos: 68 }, ...] }
    const data = response.data;
    if (!data?.details || !Array.isArray(data.details)) {
      return [];
    }

    // Extract periods where emitidos > 0
    const periods = data.details
      .filter((item) => item.emitidos > 0)
      .map((item) => String(item.periodo))
      .sort();

    console.log(`[Haulmer] Found ${periods.length} sales periods`);
    return periods;
  } catch (error) {
    if (error instanceof GaxiosError) {
      const status = error.response?.status;
      if (status === 404) {
        console.log(`[Haulmer] No sales periods found for ${rut}`);
        return [];
      }
    }
    console.warn(`[Haulmer] Error fetching sales periods:`, error);
    return [];
  }
}

/**
 * Fetch available purchase periods for RUT
 */
export async function fetchAvailablePurchasePeriods(
  rut: string,
  jwtToken: string,
  workspaceId?: string,
): Promise<string[]> {
  const url = `https://api-frontend.haulmer.com/v3/dte/core/registro/compras/periodos/${rut}`;

  console.log(`[Haulmer] Fetching available purchase periods for ${rut}`);

  const headers: Record<string, string> = {
    Authorization: `Bearer ${jwtToken}`,
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15",
    Origin: "https://espacio.haulmer.com",
    Referer: "https://espacio.haulmer.com/",
  };

  if (workspaceId) {
    headers.workspace = workspaceId;
    headers.resource = workspaceId;
  }

  try {
    const response = await request<{
      message: string | null;
      code: string;
      details?: Array<{ periodo: number; recibidos: number }>;
    }>({
      url,
      method: "GET",
      headers,
      timeout: 30000,
    });

    if (response.status !== 200) {
      throw new Error(`HTTP ${response.status}`);
    }

    // API returns { code: "OF-OK", details: [{ periodo: 202602, recibidos: 4 }, ...] }
    const data = response.data;
    if (!data?.details || !Array.isArray(data.details)) {
      return [];
    }

    // Extract periods where recibidos > 0
    const periods = data.details
      .filter((item) => item.recibidos > 0)
      .map((item) => String(item.periodo))
      .sort();

    console.log(`[Haulmer] Found ${periods.length} purchase periods`);
    return periods;
  } catch (error) {
    if (error instanceof GaxiosError) {
      const status = error.response?.status;
      if (status === 404) {
        console.log(`[Haulmer] No purchase periods found for ${rut}`);
        return [];
      }
    }
    console.warn(`[Haulmer] Error fetching purchase periods:`, error);
    return [];
  }
}

/**
 * Fetch invoice folios for RUT
 */
export async function fetchInvoiceFolios(
  rut: string,
  jwtToken: string,
  workspaceId?: string,
): Promise<Record<string, unknown> | null> {
  const url = `https://api-frontend.haulmer.com/v3/dte/core/de/invoice/dte/folios/${rut}`;

  console.log(`[Haulmer] Fetching invoice folios for ${rut}`);

  const headers: Record<string, string> = {
    Authorization: `Bearer ${jwtToken}`,
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15",
    Origin: "https://espacio.haulmer.com",
    Referer: "https://espacio.haulmer.com/",
  };

  if (workspaceId) {
    headers.workspace = workspaceId;
    headers.resource = workspaceId;
  }

  try {
    const response = await request<Record<string, unknown>>({
      url,
      method: "GET",
      headers,
      timeout: 30000,
    });

    if (response.status !== 200) {
      throw new Error(`HTTP ${response.status}`);
    }

    console.log(`[Haulmer] Retrieved invoice folios data`);
    return response.data ?? null;
  } catch (error) {
    if (error instanceof GaxiosError) {
      const status = error.response?.status;
      if (status === 404) {
        console.log(`[Haulmer] No folios found for ${rut}`);
        return null;
      }
    }
    console.warn(`[Haulmer] Error fetching folios:`, error);
    return null;
  }
}
