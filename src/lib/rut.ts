export function normalizeRut(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleaned = value.toUpperCase().replace(/[^0-9K]/g, "");
  if (!cleaned) return null;
  const body = cleaned.slice(0, -1);
  const dv = cleaned.slice(-1);
  if (!body || !/^[0-9]+$/.test(body)) return null;
  return `${parseInt(body, 10)}-${dv}`;
}

export function formatRut(value: string | null | undefined): string {
  const normalized = normalizeRut(value);
  if (!normalized) return "";
  const [body, dv] = normalized.split("-");
  if (!body || !dv) return "";
  const formattedBody = body.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${formattedBody}-${dv}`;
}
