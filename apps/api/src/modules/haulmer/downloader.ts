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
