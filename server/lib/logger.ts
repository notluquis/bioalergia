import { randomUUID } from "node:crypto";
import pino from "pino";
import type express from "express";
import type { AuthenticatedRequest } from "../types.js";

interface RequestWithLogger extends express.Request {
  log?: pino.Logger;
  requestId?: string;
}

// Configure pretty printing for development
const isDevelopment = process.env.NODE_ENV !== "production";
const prettyPrint = isDevelopment
  ? {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:standard",
        ignore: "pid,hostname",
        messageFormat: "[server] {msg}",
      },
    }
  : false;

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: undefined,
  ...(prettyPrint && { transport: prettyPrint }),
});

export function bindRequestLogger(req: express.Request, res: express.Response) {
  const requestId = randomUUID();
  const child = logger.child({ requestId, method: req.method, url: req.originalUrl });
  (req as RequestWithLogger).log = child;
  (req as RequestWithLogger).requestId = requestId;
  res.setHeader("x-request-id", requestId);
  return child;
}

export function getRequestLogger(req: express.Request) {
  return ((req as RequestWithLogger).log as pino.Logger | undefined) ?? logger;
}

export function logEvent(tag: string, details: Record<string, unknown> = {}) {
  logger.info({ tag, ...details });
}

export function logWarn(tag: string, details: Record<string, unknown> = {}) {
  logger.warn({ tag, ...details });
}

export function requestContext(req: express.Request, extra: Record<string, unknown> = {}) {
  const auth = (req as AuthenticatedRequest).auth;
  return {
    method: req.method,
    path: req.path,
    ip: req.ip,
    requestId: (req as RequestWithLogger).requestId ?? null,
    userId: auth?.userId ?? null,
    email: auth?.email ?? null,
    ...extra,
  };
}
