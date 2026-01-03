import { z } from "zod";

import { logger } from "./logger";

const UploadSummarySchema = z.object({
  status: z.string(),
  inserted: z.number(),
  skipped: z.number().optional(),
  updated: z.number().optional(),
  total: z.number(),
});

const ApiResponseSchema = UploadSummarySchema.extend({
  message: z.string().optional(),
});

export type UploadSummary = z.infer<typeof UploadSummarySchema>;

export type UploadResult = {
  file: string;
  summary?: UploadSummary;
  error?: string;
};

export async function uploadFiles(files: File[], endpoint: string, logContext: string): Promise<UploadResult[]> {
  const aggregated: UploadResult[] = [];

  for (const file of files) {
    const formData = new FormData();
    formData.append("file", file);

    try {
      logger.info(`${logContext} envío archivo`, { file: file.name, size: file.size });
      const res = await fetch(endpoint, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const json = await res.json();
      // Validar la respuesta de la API en lugar de solo hacer un type cast
      const payload = ApiResponseSchema.parse(json);

      if (!res.ok || payload.status === "error") {
        logger.warn(`${logContext} respuesta error`, { file: file.name, status: res.status, message: payload.message });
        throw new Error(payload.message || `No se pudo subir el archivo a ${endpoint}`);
      }

      logger.info(`${logContext} archivo procesado`, { file: file.name, ...payload });
      aggregated.push({ file: file.name, summary: payload });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error inesperado al subir";
      aggregated.push({ file: file.name, error: message });
      logger.error(`${logContext} archivo falló`, { file: file.name, message });
    }
  }
  return aggregated;
}

// --- New apiClient implementation ---

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: object; // Allow object for JSON body
  query?: Record<string, unknown>;
  retry?: number;
  retryDelayMs?: number;
  responseType?: "json" | "text" | "blob";
}

function buildUrlWithQuery(url: string, query?: Record<string, unknown>) {
  if (!query) return url;

  const params = new URLSearchParams();
  for (const [key, rawValue] of Object.entries(query)) {
    if (rawValue === undefined || rawValue === null) continue;
    if (Array.isArray(rawValue)) {
      for (const value of rawValue) {
        if (value === undefined || value === null) continue;
        params.append(key, String(value));
      }
      continue;
    }
    params.append(key, String(rawValue));
  }

  const queryString = params.toString();
  if (!queryString) return url;

  return url.includes("?") ? `${url}&${queryString}` : `${url}?${queryString}`;
}

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

async function parseResponse<T>(
  response: Response,
  method: string,
  url: string,
  responseType: "json" | "text" | "blob" = "json"
): Promise<T> {
  const status = response.status;
  if (responseType === "blob") {
    return (await response.blob()) as unknown as T;
  }

  const hasBody = status !== 204 && status !== 205 && status !== 304 && response.headers.get("content-length") !== "0";
  const rawBody = hasBody ? await response.text() : "";

  if (!response.ok) {
    let errorData: unknown = null;
    if (rawBody) {
      try {
        errorData = JSON.parse(rawBody);
      } catch {
        errorData = { message: rawBody };
      }
    }

    const serverMessage =
      (errorData && typeof errorData === "object" && typeof (errorData as { message?: string }).message === "string"
        ? (errorData as { message?: string }).message
        : undefined) ||
      (errorData && typeof errorData === "object" && typeof (errorData as { error?: string }).error === "string"
        ? (errorData as { error?: string }).error
        : undefined) ||
      response.statusText;
    const details =
      (errorData && typeof errorData === "object" && "details" in errorData
        ? (errorData as { details?: unknown }).details
        : undefined) ||
      (errorData && typeof errorData === "object" && "issues" in errorData
        ? (errorData as { issues?: unknown }).issues
        : undefined);

    throw new ApiError(serverMessage || "Ocurrió un error inesperado.", status, details);
  }

  let data: unknown = null;
  if (rawBody) {
    const contentType = response.headers.get("content-type") ?? "";
    const isJson = responseType === "json" || contentType.includes("application/json");

    // Safety check: if we expect JSON but get HTML (common in 404/500 from proxies), treat as error text
    const looksLikeHtml = typeof rawBody === "string" && rawBody.trimStart().startsWith("<");

    if (isJson && !looksLikeHtml) {
      try {
        data = JSON.parse(rawBody);
      } catch (e) {
        console.warn("Failed to parse JSON response:", e);
        // Fallback to text if JSON parsing fails but we expected JSON
        data = rawBody;
      }
    } else {
      data = rawBody;
    }
  }

  try {
    window.dispatchEvent(new CustomEvent("api-success", { detail: { method, url, status: response.status } }));
  } catch {
    // noop
  }

  return data as T;
}

async function request<T>(method: string, url: string, options?: RequestOptions): Promise<T> {
  const { body, query, retry = 2, retryDelayMs = 350, ...restOptions } = options || {};
  const { headers: optionHeaders, ...fetchOverrides } = restOptions;
  const headers: HeadersInit = {
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
    ...(optionHeaders ?? {}),
  };

  // Only set JSON content type if body is NOT FormData
  if (!(body instanceof FormData)) {
    (headers as Record<string, string>)["Content-Type"] = "application/json";
  }

  const config: RequestInit = {
    method,
    credentials: "include",
    cache: "no-store",
    ...fetchOverrides,
    headers,
  };

  if (body) {
    config.body = body instanceof FormData ? body : JSON.stringify(body);
  }

  const finalUrl = buildUrlWithQuery(url, query);

  for (let attempt = 0; attempt <= retry; attempt++) {
    const response = await fetch(finalUrl, config);
    if (response.status === 503 && attempt < retry) {
      const waitMs = retryDelayMs * Math.pow(2, attempt);
      await sleep(waitMs);
      continue;
    }
    return parseResponse<T>(response, method, url, options?.responseType);
  }

  throw new Error("No se pudo completar la solicitud después de reintentos.");
}

export const apiClient = {
  get: <T>(url: string, options?: RequestOptions) => request<T>("GET", url, options),
  post: <T>(url: string, body: object, options?: RequestOptions) => request<T>("POST", url, { ...options, body }),
  put: <T>(url: string, body: object, options?: RequestOptions) => request<T>("PUT", url, { ...options, body }),
  delete: <T>(url: string, options?: RequestOptions) => request<T>("DELETE", url, options),
};
