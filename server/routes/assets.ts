import express from "express";
import { isIP } from "node:net";
import { asyncHandler, authenticate } from "../lib/http.js";

type AllowedHostRule = { type: "exact"; value: string } | { type: "wildcard"; suffix: string };

const rawAllowlist = (process.env.ASSET_PROXY_ALLOWED_HOSTS ?? "")
  .split(",")
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);

const allowedHostRules: AllowedHostRule[] = rawAllowlist.map((value) =>
  value.startsWith("*.") ? { type: "wildcard", suffix: value.slice(1) } : { type: "exact", value }
);

const PRIVATE_HOSTNAME_PATTERNS = [/^localhost$/i, /\.localhost$/i, /\.local$/i, /\.internal$/i, /\.home$/i];

function isPrivateIp(hostname: string): boolean {
  const ipType = isIP(hostname);
  if (ipType === 4) {
    return (
      /^10\./.test(hostname) ||
      /^127\./.test(hostname) ||
      /^169\.254\./.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
      /^192\.168\./.test(hostname) ||
      /^0\./.test(hostname)
    );
  }
  if (ipType === 6) {
    const normalized = hostname.toLowerCase();
    return (
      normalized === "::1" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("fe80")
    );
  }
  return false;
}

function matchesAllowRule(hostname: string): boolean {
  if (!allowedHostRules.length) {
    return true;
  }
  return allowedHostRules.some((rule) => {
    if (rule.type === "exact") {
      return hostname === rule.value;
    }
    return hostname.endsWith(rule.suffix) && hostname !== rule.suffix.slice(1);
  });
}

export function registerAssetRoutes(app: express.Express) {
  // Proxy simple para imágenes remotas (logo) evitando CORS en el cliente
  app.get(
    "/api/assets/proxy-image",
    authenticate,
    asyncHandler(async (req, res) => {
      const url = String(req.query.url || "");
      try {
        if (!url || !/^https?:\/\//i.test(url)) {
          return res.status(400).json({ status: "error", message: "URL inválida" });
        }

        const u = new URL(url);
        // Restringir protocolo
        if (!(u.protocol === "http:" || u.protocol === "https:")) {
          return res.status(400).json({ status: "error", message: "Protocolo no permitido" });
        }

        const hostname = u.hostname.toLowerCase();
        if (
          PRIVATE_HOSTNAME_PATTERNS.some((pattern) => pattern.test(hostname)) ||
          isPrivateIp(hostname) ||
          !matchesAllowRule(hostname)
        ) {
          return res.status(403).json({ status: "error", message: "Host no permitido" });
        }

        const port = u.port ? Number(u.port) : u.protocol === "https:" ? 443 : 80;
        if (!Number.isFinite(port) || ![80, 443].includes(port)) {
          return res.status(400).json({ status: "error", message: "Puerto no permitido" });
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        // Descargar imagen
        let resp: Response;
        try {
          resp = await fetch(u, { redirect: "follow", signal: controller.signal });
        } finally {
          clearTimeout(timeout);
        }
        if (!resp.ok) {
          return res.status(502).json({ status: "error", message: `No se pudo obtener la imagen (${resp.status})` });
        }

        const contentType = resp.headers.get("content-type") || "application/octet-stream";
        const buf = Buffer.from(await resp.arrayBuffer());

        res.setHeader("Content-Type", contentType);
        res.setHeader("Cache-Control", "public, max-age=300"); // 5 minutos
        res.send(buf);
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return res.status(504).json({ status: "error", message: "La solicitud al host remoto expiró" });
        }
        const message = err instanceof Error ? err.message : "Fallo proxy de imagen";
        res.status(500).json({ status: "error", message });
      }
    })
  );
}
