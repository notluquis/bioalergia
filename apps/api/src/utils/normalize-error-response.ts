import type { Context } from "hono";
import { resolveErrorCode } from "./error-code-resolver";

type ErrorShape = {
  code?: unknown;
  message?: unknown;
  status?: unknown;
};

function tryParseJson(text: string): null | unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function normalizeErrorShape(
  payload: ErrorShape,
  ctx: Pick<Context, "req" | "res">,
): { changed: boolean; payload: ErrorShape } {
  if (payload.status !== "error") {
    return { changed: false, payload };
  }

  if (typeof payload.code === "string" && payload.code.length > 0) {
    return { changed: false, payload };
  }

  const message = typeof payload.message === "string" ? payload.message : undefined;
  const nextPayload: ErrorShape = {
    ...payload,
    code: resolveErrorCode({
      method: ctx.req.method,
      path: ctx.req.path,
      status: ctx.res.status,
      message,
    }),
  };

  return { changed: true, payload: nextPayload };
}

export async function normalizeErrorResponse(c: Context): Promise<void> {
  if (c.res.status < 400) {
    return;
  }

  const contentType = c.res.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/json")) {
    return;
  }

  let raw = "";
  try {
    raw = await c.res.clone().text();
  } catch {
    return;
  }

  if (!raw.trim()) {
    return;
  }

  const parsed = tryParseJson(raw);
  if (!parsed || typeof parsed !== "object") {
    return;
  }

  let changed = false;
  let next: unknown = parsed;

  // reply() serialized payload: { json: { status: "error", ... }, meta: ... }
  if (
    "json" in (parsed as Record<string, unknown>) &&
    (parsed as { json?: unknown }).json &&
    typeof (parsed as { json?: unknown }).json === "object"
  ) {
    const container = parsed as { json: ErrorShape; meta?: unknown };
    const result = normalizeErrorShape(container.json, c);
    if (result.changed) {
      changed = true;
      next = {
        ...container,
        json: result.payload,
      };
    }
  } else {
    const result = normalizeErrorShape(parsed as ErrorShape, c);
    if (result.changed) {
      changed = true;
      next = result.payload;
    }
  }

  if (!changed) {
    return;
  }

  const headers = new Headers(c.res.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  c.res = new Response(JSON.stringify(next), {
    status: c.res.status,
    headers,
  });
}
