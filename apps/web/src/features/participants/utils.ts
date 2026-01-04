import dayjs from "dayjs";

type RangeParams = {
  from?: string;
  to?: string;
};

export function resolveRange(quickValue: string, fromValue: string, toValue: string): RangeParams {
  if (quickValue === "custom") {
    const range: RangeParams = {};
    if (fromValue) range.from = fromValue;
    if (toValue) range.to = toValue;
    return range;
  }

  const value = quickValue === "current" ? dayjs().format("YYYY-MM") : quickValue;
  const [yearStr, monthStr] = value.split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;

  if (!Number.isFinite(year) || !Number.isFinite(monthIndex)) {
    return {};
  }

  const start = dayjs(new Date(year, monthIndex, 1));
  const end = start.endOf("month");

  return {
    from: start.format("YYYY-MM-DD"),
    to: end.format("YYYY-MM-DD"),
  };
}
