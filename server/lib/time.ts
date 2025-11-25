export function formatDateForDB(date: Date) {
  const pad = (value: number) => value.toString().padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

export function normalizeDate(input: string, boundary: "start" | "end") {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const parts = trimmed.split("-").map(Number);
  if (parts.length !== 3) return null;
  const [year, month, day] = parts;
  if (!year || !month || !day) return null;
  const date = new Date(
    year,
    month - 1,
    day,
    boundary === "start" ? 0 : 23,
    boundary === "start" ? 0 : 59,
    boundary === "start" ? 0 : 59,
    boundary === "start" ? 0 : 999
  );
  return formatDateForDB(date);
}

export function normalizeTimestamp(primary: string | Date | null, fallback: string | null) {
  const normalizedFallback = normalizeTimestampString(fallback);
  if (normalizedFallback) {
    return normalizedFallback;
  }

  if (primary instanceof Date) {
    return formatDateForDB(primary).replace(" ", "T");
  }

  const normalizedPrimary = normalizeTimestampString(primary);
  if (normalizedPrimary) {
    return normalizedPrimary;
  }

  return "";
}

export function normalizeTimestampForDb(primary: string | null | undefined, fallback: Date | null | undefined) {
  const normalized = normalizeTimestampString(primary ?? null);
  if (normalized) {
    return normalized.replace("T", " ");
  }

  if (fallback instanceof Date) {
    return formatDateForDB(fallback);
  }

  return "";
}

export function normalizeTimestampString(value: string | Date | null) {
  if (value == null) {
    return "";
  }

  if (value instanceof Date) {
    return formatDateForDB(value).replace(" ", "T");
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  const isoMatch = trimmed.match(
    /^([0-9]{4}-[0-9]{2}-[0-9]{2})[T ]([0-9]{2}:[0-9]{2}:[0-9]{2})(?:\.[0-9]+)?(?:Z|[+-][0-9]{2}:?[0-9]{2})?$/
  );
  if (isoMatch) {
    const [, datePart, timePart] = isoMatch;
    return `${datePart}T${timePart}`;
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return formatDateForDB(parsed).replace(" ", "T");
  }

  return trimmed.replace(" ", "T");
}

export function iterateDateRange(start: Date, end: Date) {
  const dates: string[] = [];
  const current = new Date(start);
  current.setHours(0, 0, 0, 0);
  const limit = new Date(end);
  limit.setHours(0, 0, 0, 0);

  while (current.getTime() <= limit.getTime()) {
    dates.push(formatDateOnly(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

export function parseDateOnly(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parts = trimmed.split("-").map(Number);
  if (parts.length !== 3) return null;
  const [year, month, day] = parts;
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

export function formatDateOnly(date: Date) {
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function coerceDateOnly(value: string) {
  const parsed = parseDateOnly(value);
  return parsed ? formatDateOnly(parsed) : null;
}

export function getNthBusinessDay(base: Date, n: number) {
  const date = new Date(base);
  let count = 0;
  while (count < n) {
    const day = date.getDay();
    if (day !== 0 && day !== 6) {
      count += 1;
      if (count === n) break;
    }
    date.setDate(date.getDate() + 1);
  }
  return date;
}

export function getMonthRange(month: string) {
  const [yearStr, monthStr] = month.split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  const fromDate = new Date(year, monthIndex, 1);
  const toDate = new Date(year, monthIndex + 1, 0);
  return {
    from: formatDateOnly(fromDate),
    to: formatDateOnly(toDate),
  };
}
