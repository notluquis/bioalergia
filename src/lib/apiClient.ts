import { logger } from "./logger";
import { z } from "zod";

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

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: object; // Allow object for JSON body
}

async function request<T>(method: string, url: string, options?: RequestOptions): Promise<T> {
  const { body, ...restOptions } = options || {};
  const headers = {
    "Content-Type": "application/json",
    ...restOptions?.headers,
  };

  const config: RequestInit = {
    method,
    credentials: "include",
    ...restOptions,
    headers,
  };

  if (body) {
    config.body = JSON.stringify(body);
  }

  const response = await fetch(url, config);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(errorData.message || "Ocurrió un error inesperado.");
  }

  const data = await response.json();
  try {
    // Disparar evento global para que ConnectionIndicator reinicie su temporizador
    window.dispatchEvent(new CustomEvent("api-success", { detail: { method, url, status: response.status } }));
  } catch {
    // noop (SSR o ambientes sin window)
  }
  return data;
}

export const apiClient = {
  get: <T>(url: string, options?: RequestOptions) => request<T>("GET", url, options),
  post: <T>(url: string, body: object, options?: RequestOptions) => request<T>("POST", url, { ...options, body }),
  put: <T>(url: string, body: object, options?: RequestOptions) => request<T>("PUT", url, { ...options, body }),
  delete: <T>(url: string, options?: RequestOptions) => request<T>("DELETE", url, options),
};
