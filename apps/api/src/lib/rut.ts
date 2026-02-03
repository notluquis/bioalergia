const RUT_CLEAN_REGEX = /[^0-9K]/g;
const RUT_BODY_REGEX = /^[0-9]+$/;
const RUT_DIGITS_REGEX = /\D/g;
const RUT_FORMAT_REGEX = /\B(?=(\d{3})+(?!\d))/g;

export function normalizeRut(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleaned = value.toUpperCase().replace(RUT_CLEAN_REGEX, "");
  if (!cleaned) return null;
  const body = cleaned.slice(0, -1);
  const dv = cleaned.slice(-1);
  if (!body || !RUT_BODY_REGEX.test(body)) return null;
  return `${Number.parseInt(body, 10)}-${dv}`;
}

export function validateRut(value: string | null | undefined): boolean {
  const normalized = normalizeRut(value);
  if (!normalized) return false;
  const [bodyStr, dvRaw] = normalized.split("-");
  if (!bodyStr || !dvRaw) return false;
  const body = Number(bodyStr);
  if (!Number.isFinite(body)) return false;
  const digits = bodyStr.replace(RUT_DIGITS_REGEX, "");
  let sum = 0;
  let multiplier = 2;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    sum += Number(digits[i]) * multiplier;
    multiplier += 1;
    if (multiplier > 7) multiplier = 2;
  }
  const mod = 11 - (sum % 11);
  let dvCalculated: string;
  if (mod === 11) dvCalculated = "0";
  else if (mod === 10) dvCalculated = "K";
  else dvCalculated = String(mod);
  return dvCalculated === dvRaw;
}

export function formatRut(value: string | null | undefined): string {
  const normalized = normalizeRut(value);
  if (!normalized) return "";
  const [body, dv] = normalized.split("-");
  if (!body || !dv) return "";
  const formattedBody = body.replace(RUT_FORMAT_REGEX, ".");
  return `${formattedBody}-${dv}`;
}
