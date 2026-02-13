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

function defaultErrorMessageByStatus(status: number): string {
  if (status === 401) {
    return "Tu sesión expiró. Vuelve a iniciar sesión.";
  }
  if (status === 403) {
    return "No tienes permisos para realizar esta acción.";
  }
  if (status === 404) {
    return "Recurso no encontrado.";
  }
  if (status >= 500) {
    return "Ocurrió un error interno del servidor.";
  }
  return "Ocurrió un error inesperado.";
}

function formatZodIssues(issues: z.core.$ZodIssue[]): string {
  return issues.map(formatZodIssue).join(" | ");
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
  if (!query) {
    return url;
  }

  const appendParam = (params: URLSearchParams, key: string, value: unknown) => {
    if (value !== undefined && value !== null) {
      params.append(key, String(value));
    }
  };

  const params = new URLSearchParams();
  for (const [key, rawValue] of Object.entries(query)) {
    if (Array.isArray(rawValue)) {
      for (const value of rawValue) {
        appendParam(params, key, value);
      }
      continue;
    }
    appendParam(params, key, rawValue);
  }

  const queryString = params.toString();
  if (!queryString) {
    return url;
  }

  return url.includes("?") ? `${url}&${queryString}` : `${url}?${queryString}`;
}

function parseErrorDataFromBody(rawBody: string): null | ErrorData {
  const trimmedBody = rawBody.trim();
  try {
    const parsed = JSON.parse(trimmedBody) as unknown;
    if (parsed && typeof parsed === "object") {
      return parsed as ErrorData;
    }
    if (typeof parsed === "string") {
      return { message: parsed };
    }
    return null;
  } catch {
    return { message: trimmedBody };
  }
}

// Custom hook to transform Ky errors into ApiError
async function handleKyError(error: HTTPError) {
  const response = error.response;
  const status = response.status;
  let serverMessage = response.statusText?.trim();
  let details: unknown;
  let rawBody: null | string = null;

  try {
    rawBody = await response.text();
    if (rawBody) {
      const errorData = parseErrorDataFromBody(rawBody);

      if (errorData) {
        serverMessage = errorData.message ?? errorData.error ?? serverMessage;
        details = errorData.details ?? errorData.issues ?? details;
      }
    }
  } catch {
    // Ignore body read errors
  }

  if (!serverMessage) {
    serverMessage = defaultErrorMessageByStatus(status);
  }

  if (!details && rawBody?.trim()) {
    details = { raw: rawBody.trim() };
  }

  return new ApiError(serverMessage, status, details);
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

type ResponseType = "blob" | "json" | "text";

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: FormData | object;
  query?: Record<string, unknown>;
  responseType?: ResponseType;
  retry?: number;
  responseSchema?: z.ZodTypeAny;
}

type JsonRequestOptions = Omit<RequestOptions, "responseType" | "responseSchema"> & {
  responseType?: "json";
  responseSchema: z.ZodTypeAny;
};

type NonJsonRequestOptions = Omit<RequestOptions, "responseSchema"> & {
  responseType: "blob" | "text";
};

const getIssuePath = (issue: z.core.$ZodIssue) =>
  issue.path.length ? issue.path.join(".") : "root";

const formatZodIssue = (issue: z.core.$ZodIssue) => {
  const path = getIssuePath(issue);
  if (issue.code === "invalid_type") {
    const expected =
      "expected" in issue && typeof issue.expected === "string" ? issue.expected : undefined;
    const received =
      "received" in issue && typeof issue.received === "string" ? issue.received : undefined;
    if (expected && received) {
      return `${path}: expected ${expected}, received ${received}`;
    }
  }
  return issue.message ? `${path}: ${issue.message}` : `${path}: ${issue.code}`;
};

const buildKyOptions = (
  method: string,
  fetchOptions: Omit<
    RequestOptions,
    "body" | "query" | "responseType" | "retry" | "responseSchema"
  >,
  retry?: number,
  body?: FormData | object,
): Options => {
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

  return kyOptions;
};

const buildSchemaErrorMessage = (error: z.ZodError, rawData?: unknown) => {
  const details = error.issues;
  const pretty = z.prettifyError(error);
  const issueSummary = formatZodIssues(details);
  return {
    details: {
      issues: details,
      received: rawData,
    },
    message: pretty
      ? `Respuesta inválida del servidor:\n${pretty}`
      : issueSummary
        ? `Respuesta inválida del servidor: ${issueSummary}`
        : "Respuesta inválida del servidor",
  };
};

async function parseResponse<T>(
  res: Response,
  responseType: ResponseType,
  responseSchema?: z.ZodTypeAny,
): Promise<T> {
  if (responseType === "blob") {
    return (await res.blob()) as unknown as T;
  }

  if (responseType === "text") {
    return (await res.text()) as unknown as T;
  }

  const rawText = await res.text();
  const data: unknown = rawText ? superJsonParser(rawText) : null;
  if (!responseSchema) {
    return data as T;
  }

  const parsed = responseSchema.safeParse(data);
  if (parsed.success) {
    return parsed.data as T;
  }

  const { details, message } = buildSchemaErrorMessage(parsed.error, data);
  throw new ApiError(message, 500, details);
}

async function request<T>(method: string, url: string, options?: RequestOptions): Promise<T> {
  const { body, query, responseType = "json", retry, ...fetchOptions } = options ?? {};

  const finalUrl = buildUrlWithQuery(url, query);
  const kyOptions = buildKyOptions(method, fetchOptions, retry, body);

  try {
    const res = await kyInstance(finalUrl, kyOptions);
    return await parseResponse<T>(res, responseType, options?.responseSchema);
  } catch (error) {
    if (error instanceof HTTPError) {
      throw await handleKyError(error);
    }
    throw error;
  }
}

export const apiClient = {
  delete: <T>(url: string, options: JsonRequestOptions) => request<T>("DELETE", url, options),
  get: <T>(url: string, options: JsonRequestOptions) => request<T>("GET", url, options),
  post: <T>(url: string, body: FormData | object, options: JsonRequestOptions) =>
    request<T>("POST", url, { ...options, body }),
  put: <T>(url: string, body: FormData | object, options: JsonRequestOptions) =>
    request<T>("PUT", url, { ...options, body }),
  getRaw: <T>(url: string, options: NonJsonRequestOptions) => request<T>("GET", url, options),
  postRaw: <T>(url: string, body: FormData | object, options: NonJsonRequestOptions) =>
    request<T>("POST", url, { ...options, body }),
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
