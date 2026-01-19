import ky, { HTTPError, type Options } from "ky";
import superjson from "superjson";
import { z } from "zod";

import { logger } from "./logger";

interface ErrorData {
  details?: unknown;
  error?: string;
  issues?: unknown;
  message?: string;
}

export class ApiError extends Error {
  details?: unknown;
  status: number;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

// Helper for building query strings with custom array handling (preserved for safety)
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

// Custom hook to transform Ky errors into ApiError
async function handleKyError(error: HTTPError) {
  const response = error.response;
  const status = response.status;
  let serverMessage = response.statusText;
  let details: unknown;

  try {
    const rawBody = await response.text();
    if (rawBody) {
      let errorData: ErrorData | null = null;
      try {
        errorData = JSON.parse(rawBody);
      } catch {
        // If not JSON, treat body as simple message
        errorData = { message: rawBody };
      }

      if (errorData) {
        serverMessage = errorData.message ?? errorData.error ?? serverMessage;
        details = errorData.details ?? errorData.issues;
      }
    }
  } catch {
    // Ignore body read errors
  }

  return new ApiError(serverMessage || "Ocurrió un error inesperado.", status, details);
}

// SuperJSON Parser
const superJsonParser = (text: string) => {
  try {
    const jsonData = JSON.parse(text);
    if (jsonData && typeof jsonData === "object" && "json" in jsonData) {
      return superjson.deserialize(jsonData);
    }
    return jsonData;
  } catch {
    return text;
  }
};

const kyInstance = ky.create({
  credentials: "include", // CRITICAL: Send cookies with every request
  parseJson: superJsonParser,
  retry: {
    limit: 2,
    methods: ["get", "put", "head", "delete", "options", "trace"],
    statusCodes: [408, 413, 429, 500, 502, 503, 504],
  },
  timeout: 30_000,
});

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: object;
  query?: Record<string, unknown>;
  responseType?: "blob" | "json" | "text";
  retry?: number;
}

async function request<T>(method: string, url: string, options?: RequestOptions): Promise<T> {
  const { body, query, responseType = "json", retry, ...fetchOptions } = options ?? {};

  const finalUrl = buildUrlWithQuery(url, query);

  // Ky specific options
  const kyOptions: Options = {
    method,
    retry,
    ...fetchOptions,
  };

  if (body) {
    if (body instanceof FormData) {
      kyOptions.body = body;
    } else {
      kyOptions.json = body;
    }
  }

  try {
    const res = await kyInstance(finalUrl, kyOptions);

    if (responseType === "blob") {
      return (await res.blob()) as unknown as T;
    }

    if (responseType === "text") {
      return (await res.text()) as unknown as T;
    }

    // responseType === 'json' (default)
    // kyInstance already has parseJson configured for superjson
    return await res.json<T>();
  } catch (error) {
    if (error instanceof HTTPError) {
      throw await handleKyError(error);
    }
    throw error;
  }
}

export const apiClient = {
  delete: <T>(url: string, options?: RequestOptions) => request<T>("DELETE", url, options),
  get: <T>(url: string, options?: RequestOptions) => request<T>("GET", url, options),
  post: <T>(url: string, body: object, options?: RequestOptions) =>
    request<T>("POST", url, { ...options, body }),
  put: <T>(url: string, body: object, options?: RequestOptions) =>
    request<T>("PUT", url, { ...options, body }),
};

// Upload Files - simplified with Ky
const UploadSummarySchema = z.object({
  inserted: z.number(),
  skipped: z.number().optional(),
  status: z.string(),
  total: z.number(),
  updated: z.number().optional(),
});

const ApiResponseSchema = UploadSummarySchema.extend({
  message: z.string().optional(),
});

export interface UploadResult {
  error?: string;
  file: string;
  summary?: UploadSummary;
}
export type UploadSummary = z.infer<typeof UploadSummarySchema>;

export async function uploadFiles(
  files: File[],
  endpoint: string,
  logContext: string,
): Promise<UploadResult[]> {
  const aggregated: UploadResult[] = [];

  for (const file of files) {
    const formData = new FormData();
    formData.append("file", file);

    try {
      logger.info(`${logContext} envío archivo`, { file: file.name, size: file.size });

      const res = await kyInstance.post(endpoint, {
        body: formData,
        timeout: false,
      });

      const json = await res.json();
      const payload = ApiResponseSchema.parse(json);

      if (payload.status === "error") {
        throw new Error(payload.message ?? "Error status returned");
      }

      logger.info(`${logContext} archivo procesado`, { file: file.name, ...payload });
      aggregated.push({ file: file.name, summary: payload });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error inesperado al subir";
      aggregated.push({ error: message, file: file.name });
      logger.error(`${logContext} archivo falló`, { file: file.name, message });
    }
  }
  return aggregated;
}
