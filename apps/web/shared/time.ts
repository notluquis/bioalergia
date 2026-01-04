export function durationToMinutes(duration: string): number {
  if (!duration) return 0;
  const [hours = "0", minutes = "0"] = duration.split(":");
  const h = Number(hours);
  const m = Number(minutes);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
}

export function minutesToDuration(minutes: number): string {
  if (!Number.isFinite(minutes)) return "0:00";
  const sign = minutes < 0 ? "-" : "";
  const total = Math.abs(Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${sign}${String(h)}:${String(m).padStart(2, "0")}`;
}

export function parseTimeToMinutes(value: string): number | null {
  if (!value) return null;
  const [hoursStr, minutesStr] = value.split(":");
  if (hoursStr == null || minutesStr == null) return null;
  const hours = Number(hoursStr);
  const minutes = Number(minutesStr);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

export function minutesToTime(minutes: number | null): string | null {
  if (minutes == null || !Number.isFinite(minutes)) return null;
  const total = Math.round(minutes);
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
