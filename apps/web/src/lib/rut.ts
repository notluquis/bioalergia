export function normalizeRut(value?: string | null): string | null {
  if (!value) return null;
  const cleaned = value.toUpperCase().replaceAll(/[^0-9K]/g, "");
  if (!cleaned) return null;
  const body = cleaned.slice(0, -1);
  const dv = cleaned.slice(-1);
  if (!body || !/^\d+$/.test(body)) return null;
  return `${Number.parseInt(body, 10)}-${dv}`;
}

export function formatRut(value?: string | null): string {
  if (!value || typeof value !== "string") return "";

  const normalized = normalizeRut(value);
  if (!normalized) return "";
  const [body, dv] = normalized.split("-");
  if (!body || !dv) return "";
  const formattedBody = new Intl.NumberFormat("es-CL").format(Number(body));
  return `${formattedBody}-${dv}`;
}

export function validateRut(value?: string | null): boolean {
  const normalized = normalizeRut(value);
  if (!normalized) return false;
  const [body, dv] = normalized.split("-");
  if (!body || !dv) return false;

  let sum = 0;
  let multiplier = 2;

  // Iterate backwards over the body digits
  for (let i = body.length - 1; i >= 0; i--) {
    sum += Number.parseInt(body.charAt(i), 10) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const remainder = 11 - (sum % 11);
  let computedDv = "";
  if (remainder === 11) computedDv = "0";
  else if (remainder === 10) computedDv = "K";
  else computedDv = remainder.toString();

  return computedDv === dv;
}
