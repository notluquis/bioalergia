export type CapturedEntry = {
  ts: string;
  src: string;
  data: unknown;
};

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
