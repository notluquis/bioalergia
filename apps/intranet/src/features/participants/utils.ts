import { endOfMonthFor, today } from "@/lib/dates";

interface RangeParams {
  from?: string;
  to?: string;
}

export function resolveRange(quickValue: string, fromValue: string, toValue: string): RangeParams {
  if (quickValue === "custom") {
    const range: RangeParams = {};
    if (fromValue) {
      range.from = fromValue;
    }
    if (toValue) {
      range.to = toValue;
    }
    return range;
  }

  const value = quickValue === "current" ? today().slice(0, 7) : quickValue;
  const [yearStr, monthStr] = value.split("-");
  const year = Number(yearStr);
  const monthNumber = Number(monthStr);

  if (!Number.isFinite(year) || !Number.isFinite(monthNumber)) {
    return {};
  }

  const start = `${year}-${String(monthNumber).padStart(2, "0")}-01`;

  return {
    from: start,
    to: endOfMonthFor(start),
  };
}
