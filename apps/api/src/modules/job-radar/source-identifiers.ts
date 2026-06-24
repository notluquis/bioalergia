import type { JobSourceKind } from "@finanzas/orpc-contracts/job-radar";
import { BROWSER_UA, requestText } from "./_shared.ts";

function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function normalizeAiravirtualIdentifier(identifier: string): string {
  const url = parseUrl(identifier);
  if (!url) {
    return identifier.replace(/^aira_/i, "").replace(/\.json$/i, "");
  }

  const host = url.hostname.toLowerCase();
  if (host === "jobs.airavirtual.com") {
    return url.pathname.split("/").filter(Boolean)[0] ?? identifier;
  }

  if (host === "gcs-files.airavirtual.com" || host === "gcs-storage.airavirtual.com") {
    const file = url.pathname.split("/").filter(Boolean).at(-1) ?? "";
    const match = file.match(/^aira_(.+)\.json$/i);
    if (match?.[1]) return match[1];
  }

  return identifier;
}

function extractAiravirtualSlugFromHtml(html: string): string | null {
  const assetsMatch = html.match(/companies_assets\/([A-Za-z0-9_-]+)\//);
  if (assetsMatch?.[1]) return assetsMatch[1];

  const feedMatch = html.match(/aira_([A-Za-z0-9_-]+)\.json/i);
  if (feedMatch?.[1]) return feedMatch[1];

  const jobsMatch = html.match(/https:\/\/jobs\.airavirtual\.com\/([A-Za-z0-9_-]+)/i);
  return jobsMatch?.[1] ?? null;
}

async function normalizeAiravirtualIdentifierAsync(identifier: string): Promise<string> {
  const normalized = normalizeAiravirtualIdentifier(identifier);
  if (normalized !== identifier) return normalized;

  const url = parseUrl(identifier);
  const host = url?.hostname.toLowerCase();
  if (host !== "login.airavirtual.com") return normalized;
  if (!url) return normalized;
  if (!url.pathname.startsWith("/offer_info/") && !url.pathname.startsWith("/postula/")) {
    return normalized;
  }

  const html = await requestText(identifier, {
    tag: "job_radar.airavirtual.source_discovery",
    ctx: { identifier },
    accept: "text/html,*/*",
    userAgent: BROWSER_UA,
  });
  return html ? (extractAiravirtualSlugFromHtml(html) ?? normalized) : normalized;
}

function normalizeTrabajandoIdentifier(identifier: string): string {
  const url = parseUrl(identifier);
  if (!url) return identifier.replace(/\.trabajando\.cl$/i, "");

  const host = url.hostname.toLowerCase();
  if (host.endsWith(".trabajando.cl")) {
    return host.replace(/\.trabajando\.cl$/i, "");
  }

  return identifier;
}

export function normalizeJobSourceIdentifier(kind: JobSourceKind, rawIdentifier: string): string {
  const identifier = rawIdentifier.trim();
  if (identifier.length === 0) return identifier;

  switch (kind) {
    case "AIRAVIRTUAL":
      return normalizeAiravirtualIdentifier(identifier);
    case "TRABAJANDO":
      return normalizeTrabajandoIdentifier(identifier);
    default:
      return identifier;
  }
}

export async function normalizeJobSourceIdentifierAsync(
  kind: JobSourceKind,
  rawIdentifier: string
): Promise<string> {
  const identifier = rawIdentifier.trim();
  if (identifier.length === 0) return identifier;

  switch (kind) {
    case "AIRAVIRTUAL":
      return normalizeAiravirtualIdentifierAsync(identifier);
    default:
      return normalizeJobSourceIdentifier(kind, identifier);
  }
}

export const __test__ = { extractAiravirtualSlugFromHtml };
