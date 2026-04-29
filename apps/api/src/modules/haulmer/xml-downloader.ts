/**
 * Download DTE XML from Haulmer API and parse line items.
 *
 * Issued:   GET /v3/dte/core/de/docs/issued/xml/{rut}/{tipoDTE}/{folio}/1
 * Received: GET /v3/dte/core/dte_recibidos/xml/{rut}/{rutProveedor}/{tipoDTE}/{folio}
 */

import { GaxiosError, request } from "gaxios";

interface HaulmerXmlHeaders {
  jwtToken: string;
  workspaceId?: string;
}

/**
 * Clean RUT for Haulmer API: remove dots, dash, and verification digit.
 * "76.406.172-1" → "76406172", "76414634-3" → "76414634"
 */
function cleanRutForApi(rut: string): string {
  const cleaned = rut.replace(/\./g, "");
  // Remove dash and everything after it (verification digit)
  const dashIdx = cleaned.indexOf("-");
  return dashIdx >= 0 ? cleaned.substring(0, dashIdx) : cleaned;
}

function buildHeaders(auth: HaulmerXmlHeaders): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${auth.jwtToken}`,
    Accept: "text/xml",
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15",
    Origin: "https://espacio.haulmer.com",
    Referer: "https://espacio.haulmer.com/",
  };

  if (auth.workspaceId) {
    headers.workspace = auth.workspaceId;
    headers.resource = auth.workspaceId;
  }

  return headers;
}

/**
 * Download XML for an issued DTE (boleta, factura emitida, nota de crédito, etc.)
 */
export async function downloadIssuedDteXml(
  rut: string,
  documentType: number,
  folio: string,
  auth: HaulmerXmlHeaders,
): Promise<string> {
  const url = `https://api-frontend.haulmer.com/v3/dte/core/de/docs/issued/xml/${cleanRutForApi(rut)}/${documentType}/${folio}/1`;

  const response = await request<string>({
    url,
    method: "GET",
    headers: buildHeaders(auth),
    timeout: 30000,
    responseType: "text",
  });

  if (response.status !== 200 || !response.data) {
    throw new Error(`Failed to download issued DTE XML: HTTP ${response.status}`);
  }

  return response.data;
}

/**
 * Download XML for a received DTE (factura de compra recibida)
 */
export async function downloadReceivedDteXml(
  ownerRut: string,
  providerRut: string,
  documentType: number,
  folio: string,
  auth: HaulmerXmlHeaders,
): Promise<string> {
  const url = `https://api-frontend.haulmer.com/v3/dte/core/dte_recibidos/xml/${cleanRutForApi(ownerRut)}/${cleanRutForApi(providerRut)}/${documentType}/${folio}`;

  const response = await request<string>({
    url,
    method: "GET",
    headers: buildHeaders(auth),
    timeout: 30000,
    responseType: "text",
  });

  if (response.status !== 200 || !response.data) {
    throw new Error(`Failed to download received DTE XML: HTTP ${response.status}`);
  }

  return response.data;
}

/**
 * Try to download XML, return null on 404 (document not found in Haulmer)
 */
export async function tryDownloadDteXml(
  params: {
    direction: "issued" | "received";
    ownerRut: string;
    providerRut?: string;
    documentType: number;
    folio: string;
  },
  auth: HaulmerXmlHeaders,
): Promise<string | null> {
  try {
    if (params.direction === "issued") {
      return await downloadIssuedDteXml(
        params.ownerRut,
        params.documentType,
        params.folio,
        auth,
      );
    }
    if (!params.providerRut) {
      throw new Error("providerRut required for received DTEs");
    }
    return await downloadReceivedDteXml(
      params.ownerRut,
      params.providerRut,
      params.documentType,
      params.folio,
      auth,
    );
  } catch (error) {
    if (error instanceof GaxiosError && error.response?.status === 404) {
      return null;
    }
    throw error;
  }
}
