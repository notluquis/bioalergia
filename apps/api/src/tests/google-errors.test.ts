import { GaxiosError } from "gaxios";
import { describe, expect, it, vi } from "vitest";
import { GoogleApiError, parseGoogleError, retryGoogleCall } from "../lib/google/google-errors";

type MinimalResponse = {
  status: number;
  data?: unknown;
  headers?: Record<string, string>;
};

type GaxiosResponseLike = {
  status: number;
  statusText: string;
  data: unknown;
  headers: Record<string, string>;
  config: { url: string; method: string };
};

function buildGaxiosError(message: string, response: MinimalResponse) {
  const responseLike: GaxiosResponseLike = {
    status: response.status,
    statusText: "",
    data: response.data ?? null,
    headers: response.headers ?? {},
    config: { url: "https://example.com", method: "GET" },
  };
  const error = Object.create(GaxiosError.prototype) as GaxiosError & {
    response?: GaxiosResponseLike;
    config?: { url: string; method: string };
  };
  error.name = "GaxiosError";
  error.message = message;
  error.code = String(response.status);
  error.config = responseLike.config;
  error.response = responseLike;
  return error;
}

describe("google-errors", () => {
  it("parses legacy Google API error format", () => {
    const error = buildGaxiosError("Legacy error", {
      status: 403,
      data: {
        error: {
          errors: [
            {
              reason: "userRateLimitExceeded",
              domain: "usageLimits",
              message: "Rate limit exceeded",
            },
          ],
          message: "Rate limit exceeded",
        },
      },
    });
    expect((error as { response?: { data?: unknown } }).response?.data).toEqual({
      error: {
        errors: [
          {
            reason: "userRateLimitExceeded",
            domain: "usageLimits",
            message: "Rate limit exceeded",
          },
        ],
        message: "Rate limit exceeded",
      },
    });

    const parsed = parseGoogleError(error);
    expect(parsed.code).toBe(403);
    expect(parsed.reason).toBe("userRateLimitExceeded");
    expect(parsed.domain).toBe("usageLimits");
    expect(parsed.message).toBe("Límite de solicitudes excedido. Intenta en unos minutos.");
    expect(parsed.status).toBeUndefined();
    expect(parsed.metadata).toBeUndefined();
  });

  it("parses AIP-193 ErrorInfo details when present", () => {
    const error = buildGaxiosError("AIP error", {
      status: 429,
      data: {
        error: {
          status: "RESOURCE_EXHAUSTED",
          message: "Quota exceeded",
          details: [
            {
              "@type": "type.googleapis.com/google.rpc.ErrorInfo",
              reason: "RATE_LIMIT_EXCEEDED",
              domain: "googleapis.com",
              metadata: { quotaLocation: "global" },
            },
          ],
        },
      },
    });
    expect((error as { response?: { data?: unknown } }).response?.data).toEqual({
      error: {
        status: "RESOURCE_EXHAUSTED",
        message: "Quota exceeded",
        details: [
          {
            "@type": "type.googleapis.com/google.rpc.ErrorInfo",
            reason: "RATE_LIMIT_EXCEEDED",
            domain: "googleapis.com",
            metadata: { quotaLocation: "global" },
          },
        ],
      },
    });

    const parsed = parseGoogleError(error);
    expect(parsed.code).toBe(429);
    expect(parsed.status).toBe("RESOURCE_EXHAUSTED");
    expect(parsed.reason).toBe("RATE_LIMIT_EXCEEDED");
    expect(parsed.domain).toBe("googleapis.com");
    expect(parsed.metadata).toEqual({ quotaLocation: "global" });
    expect(parsed.message).toBe("Demasiadas solicitudes. Espera un momento antes de reintentar.");
  });

  it("extracts retry-after header into retryAfterSeconds", () => {
    const error = buildGaxiosError("Retry after", {
      status: 503,
      headers: { "retry-after": "120" },
      data: { error: { message: "Service Unavailable" } },
    });

    const parsed = parseGoogleError(error);
    expect(parsed.code).toBe(503);
    expect(parsed.retryAfterSeconds).toBe(120);
  });

  it("wraps non-gaxios errors", () => {
    const parsed = parseGoogleError(new Error("boom"));
    expect(parsed.code).toBe(500);
    expect(parsed.reason).toBe("unknown");
    expect(parsed.domain).toBe("application");
    expect(parsed.message).toBe("boom");
  });

  it("retries with retryAfterSeconds and returns the final result", async () => {
    vi.useFakeTimers();
    let attempts = 0;

    const operation = vi.fn(async () => {
      attempts += 1;
      if (attempts < 3) {
        throw new GoogleApiError({
          code: 429,
          status: "RESOURCE_EXHAUSTED",
          reason: "rateLimitExceeded",
          domain: "googleapis.com",
          message: "Rate limit exceeded",
          retryAfterSeconds: 1,
          originalError: new Error("rate limit"),
        });
      }
      return "ok";
    });

    const promise = retryGoogleCall(operation, {
      maxAttempts: 3,
      baseDelayMs: 1,
      jitter: 0,
      context: "test.retry",
    });

    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe("ok");
    expect(operation).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });
});
