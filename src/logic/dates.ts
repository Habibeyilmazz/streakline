// A DayKey is a calendar date ('YYYY-MM-DD') with no time and no zone.
// Everything the app stores about "which day" is a DayKey, so history never
// shifts when the device changes time zone or the clocks change for DST.
// All arithmetic runs on UTC day numbers, where every day is exactly 24h.
export type DayKey = string;

const MS_PER_DAY = 86_400_000;
const pad = (n: number) => String(n).padStart(2, '0');

/** The local calendar date of an instant, in the device's current zone. */
export function dayKey(d: Date): DayKey {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Days since 1970-01-01. Only meaningful for valid DayKeys. */
export function dayNumber(k: DayKey): number {
  return Date.UTC(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8, 10)) / MS_PER_DAY;
}

export function fromDayNumber(n: number): DayKey {
  return new Date(n * MS_PER_DAY).toISOString().slice(0, 10);
}

export function isDayKey(v: unknown): v is DayKey {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const n = dayNumber(v);
  // Round-tripping rejects impossible dates such as 2026-02-30.
  return Number.isFinite(n) && fromDayNumber(n) === v;
}

export function addDays(k: DayKey, n: number): DayKey {
  return fromDayNumber(dayNumber(k) + n);
}

/** 0 = Sunday ... 6 = Saturday, matching Date#getDay. */
export function weekday(k: DayKey): number {
  // 1970-01-01 was a Thursday (4).
  return (((dayNumber(k) + 4) % 7) + 7) % 7;
}

/** The Monday of the week containing k. */
export function weekStart(k: DayKey): DayKey {
  return addDays(k, -((weekday(k) + 6) % 7));
}

/** Inclusive range; empty when to < from. */
export function eachDay(from: DayKey, to: DayKey): DayKey[] {
  const out: DayKey[] = [];
  for (let n = dayNumber(from), end = dayNumber(to); n <= end; n++) out.push(fromDayNumber(n));
  return out;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const monthShort = (k: DayKey) => MONTHS[+k.slice(5, 7) - 1];
export const weekdayLong = (k: DayKey) => WEEKDAYS_LONG[weekday(k)];
/** "21 November" */
export const dayMonthLong = (k: DayKey) => `${+k.slice(8, 10)} ${MONTHS_LONG[+k.slice(5, 7) - 1]}`;
/** "21 Nov" */
export const dayMonthShort = (k: DayKey) => `${+k.slice(8, 10)} ${monthShort(k)}`;
/** "16 to 22 Nov" or "30 Nov to 6 Dec" */
export function rangeLabel(from: DayKey, to: DayKey): string {
  return monthShort(from) === monthShort(to)
    ? `${+from.slice(8, 10)} to ${dayMonthShort(to)}`
    : `${dayMonthShort(from)} to ${dayMonthShort(to)}`;
}
