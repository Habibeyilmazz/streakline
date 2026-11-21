import { DayKey, isDayKey } from './dates';
import { parseTime } from './reminders';
import {
  DEFAULT_SETTINGS,
  Data,
  FocusSession,
  HABIT_COLOR_COUNT,
  Habit,
  MAX_ANSWER_LENGTH,
  MAX_HABITS,
  MAX_NAME_LENGTH,
  MAX_SESSIONS,
  Reflection,
  Schedule,
  Settings,
} from './types';

// Backup files and stored state both come from outside the running app, so
// they go through the same validator. It throws with a message a person can
// act on, and returns a normalised copy (sorted, de-duplicated, no orphans).
// Anything the validator refuses, the reducer must also refuse to create:
// otherwise the app could save a state it cannot load again.

export const BACKUP_VERSION = 1;
// Years of heavy use export to well under 1 MB.
export const MAX_BACKUP_CHARS = 20 * 1024 * 1024;
// Wide enough that a phone with a badly wrong clock still writes days the next
// launch can read back; narrow enough to bound the streak loops.
const MIN_DAY = '1970-01-01';
const MAX_DAY = '2199-12-31';

class Invalid extends Error {}
const fail = (msg: string): never => {
  throw new Invalid(msg);
};

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const int = (v: unknown, min: number, max: number, what: string): number =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : fail(`${what} must be a whole number from ${min} to ${max}.`);

const day = (v: unknown, what: string): DayKey =>
  isDayKey(v) && v >= MIN_DAY && v <= MAX_DAY ? v : fail(`${what} is not a valid date (YYYY-MM-DD).`);

const time = (v: unknown, what: string): string | null =>
  v === null || v === undefined ? null : typeof v === 'string' && parseTime(v) ? v : fail(`${what} must be a time like 20:30.`);

const days = (v: unknown, what: string): DayKey[] =>
  Array.isArray(v) ? [...new Set(v.map((d) => day(d, what)))].sort() : fail(`${what} must be a list of dates.`);

function id(v: unknown, what: string): string {
  // Ids become object keys, so names inherited from Object.prototype are refused.
  if (typeof v !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(v) || v in {}) return fail(`${what} is not a valid id.`);
  return v;
}

function schedule(v: unknown, what: string): Schedule {
  if (isObject(v)) {
    if (v.kind === 'daily') return { kind: 'daily' };
    if (v.kind === 'weekly') return { kind: 'weekly', times: int(v.times, 1, 7, `${what} times per week`) };
    if (v.kind === 'weekdays' && Array.isArray(v.days) && v.days.length > 0) {
      const set = new Set(v.days.map((d) => int(d, 0, 6, `${what} weekday`)));
      return { kind: 'weekdays', days: [...set].sort() };
    }
  }
  return fail(`${what} has an unknown schedule.`);
}

function habit(v: unknown, i: number): Habit {
  const what = `Habit ${i + 1}`;
  if (!isObject(v)) return fail(`${what} is not an object.`);
  const name = typeof v.name === 'string' ? v.name.trim() : '';
  if (!name || name.length > MAX_NAME_LENGTH) fail(`${what} needs a name of 1 to ${MAX_NAME_LENGTH} characters.`);
  return {
    id: id(v.id, `${what} id`),
    name,
    color: int(v.color, 0, HABIT_COLOR_COUNT - 1, `${what} colour`),
    schedule: schedule(v.schedule, what),
    createdOn: day(v.createdOn, `${what} creation date`),
    reminder: time(v.reminder, `${what} reminder`),
  };
}

function settings(v: unknown): Settings {
  if (v === undefined) return DEFAULT_SETTINGS;
  if (!isObject(v)) return fail('Settings are not an object.');
  const bool = (x: unknown, fallback: boolean, what: string) =>
    x === undefined ? fallback : typeof x === 'boolean' ? x : fail(`${what} must be true or false.`);
  const theme = v.theme ?? DEFAULT_SETTINGS.theme;
  return {
    theme: theme === 'system' || theme === 'light' || theme === 'dark' ? theme : fail('Theme must be system, light or dark.'),
    haptics: bool(v.haptics, DEFAULT_SETTINGS.haptics, 'Haptics'),
    focusMinutes: int(v.focusMinutes ?? DEFAULT_SETTINGS.focusMinutes, 1, 180, 'Focus length'),
    breakMinutes: int(v.breakMinutes ?? DEFAULT_SETTINGS.breakMinutes, 1, 60, 'Break length'),
    autoCheckIn: bool(v.autoCheckIn, DEFAULT_SETTINGS.autoCheckIn, 'Auto check-in'),
    reflectionReminder: time(v.reflectionReminder, 'Reflection reminder'),
  };
}

/** Throws an Error with a readable message when `raw` is not valid app data. */
export function validateData(raw: unknown): Data {
  if (!isObject(raw)) return fail('The file does not contain Streakline data.');
  if (!Array.isArray(raw.habits)) return fail('The list of habits is missing.');
  if (raw.habits.length > MAX_HABITS) fail(`Too many habits (the limit is ${MAX_HABITS}).`);
  const habits = raw.habits.map(habit);
  const ids = new Set(habits.map((h) => h.id));
  if (ids.size !== habits.length) fail('Two habits share the same id.');

  const dayLists = (v: unknown, what: string) => {
    if (v !== undefined && !isObject(v)) fail(`${what} are not an object.`);
    const src = (v ?? {}) as Record<string, unknown>;
    // Every habit gets its own entry; entries for unknown habits are dropped.
    return Object.fromEntries(habits.map((h) => [h.id, Object.prototype.hasOwnProperty.call(src, h.id) ? days(src[h.id], `${what} for "${h.name}"`) : []]));
  };

  const rawSessions = raw.sessions ?? [];
  if (!Array.isArray(rawSessions) || rawSessions.length > MAX_SESSIONS) return fail('Focus sessions must be a list.');
  const sessions = rawSessions.map((s, i): FocusSession => {
    if (!isObject(s)) return fail(`Focus session ${i + 1} is not an object.`);
    return {
      id: id(s.id, `Focus session ${i + 1} id`),
      habitId: typeof s.habitId === 'string' && ids.has(s.habitId) ? s.habitId : null,
      day: day(s.day, `Focus session ${i + 1} date`),
      minutes: int(s.minutes, 1, 600, `Focus session ${i + 1} minutes`),
    };
  });

  const rawReflections = raw.reflections ?? {};
  if (!isObject(rawReflections)) return fail('Reflections are not an object.');
  const reflections: Record<DayKey, Reflection> = {};
  for (const [k, v] of Object.entries(rawReflections)) {
    const a = isObject(v) ? v.answers : undefined;
    if (!Array.isArray(a) || a.length !== 3 || !a.every((x) => typeof x === 'string' && x.length <= MAX_ANSWER_LENGTH)) {
      return fail(`The reflection for ${k} must have three text answers.`);
    }
    reflections[day(k, 'A reflection date')] = { answers: [a[0], a[1], a[2]] };
  }

  return {
    habits,
    checkins: dayLists(raw.checkins, 'Check-ins'),
    freezes: dayLists(raw.freezes, 'Freezes'),
    sessions,
    reflections,
    settings: settings(raw.settings),
  };
}

export function exportBackup(data: Data, exportedAt: Date): string {
  return JSON.stringify({ app: 'streakline', version: BACKUP_VERSION, exportedAt: exportedAt.toISOString(), data }, null, 2);
}

export type ParseResult = { ok: true; data: Data } | { ok: false; error: string };

export function parseBackup(text: string): ParseResult {
  if (text.length > MAX_BACKUP_CHARS) return { ok: false, error: 'The file is too large to be a Streakline backup.' };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'The file is not valid JSON.' };
  }
  if (!isObject(raw) || raw.app !== 'streakline') return { ok: false, error: 'This is not a Streakline backup file.' };
  if (raw.version !== BACKUP_VERSION) {
    return { ok: false, error: `This backup is version ${String(raw.version)}; this app reads version ${BACKUP_VERSION}.` };
  }
  try {
    return { ok: true, data: validateData(raw.data) };
  } catch (e) {
    if (e instanceof Invalid) return { ok: false, error: e.message };
    throw e;
  }
}
