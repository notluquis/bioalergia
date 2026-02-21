import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";

export interface AppErrorOptions {
  code: string;
  details?: unknown;
  expose?: boolean;
  message: string;
}

export class AppError extends HTTPException {
  readonly code: string;
  readonly details?: unknown;
  readonly expose: boolean;

  constructor(status: ContentfulStatusCode, options: AppErrorOptions) {
    super(status, { message: options.message });
    this.code = options.code;
    this.details = options.details;
    this.expose = options.expose ?? status < 500;
  }
}
