import fs from "node:fs";
import path from "node:path";

export type CapturedEntry = {
  ts: string;
  src: string;
  data: unknown;
};

export function saveCaptureToDisk(capturesDir: string, entries: CapturedEntry[]): string {
  fs.mkdirSync(capturesDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = path.join(capturesDir, `calendarevents_${stamp}.json`);
  fs.writeFileSync(file, JSON.stringify({ entries }, null, 2), "utf8");
  return file;
}

export async function postToImportEndpoint(
  endpoint: string,
  token: string | undefined,
  entries: CapturedEntry[],
): Promise<{ ok: boolean; status: number; body: string }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({ entries }),
  });
  const body = await res.text();
  return { ok: res.ok, status: res.status, body };
}
