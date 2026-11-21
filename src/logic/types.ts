import type { DayKey } from './dates';

export type Schedule =
  | { kind: 'daily' }
  /** Specific weekdays, 0 = Sunday ... 6 = Saturday. Never empty. */
  | { kind: 'weekdays'; days: number[] }
  /** Any N days in a Monday-to-Sunday week, 1..7. */
  | { kind: 'weekly'; times: number };

export type Habit = {
  id: string;
  name: string;
  /** Index into the theme's habit palette. */
  color: number;
  schedule: Schedule;
  createdOn: DayKey;
  /** Local reminder time 'HH:MM', or null for none. */
  reminder: string | null;
  /** First day the habit is no longer tracked. Absent while it is active. Its history stays. */
  archivedOn?: DayKey;
  /** Past stretches it was archived and then restored: excused, never missed. Sorted, no overlaps, inclusive. */
  pauses?: Pause[];
};

export type Pause = { from: DayKey; to: DayKey };

export type FocusSession = {
  id: string;
  habitId: string | null;
  day: DayKey;
  minutes: number;
};

export type Reflection = { answers: [string, string, string] };

export type Settings = {
  theme: 'system' | 'light' | 'dark';
  haptics: boolean;
  focusMinutes: number;
  breakMinutes: number;
  /** Check the habit in for the day when a focus session tied to it finishes. */
  autoCheckIn: boolean;
  /** Local time 'HH:MM' for the evening reflection reminder, or null. */
  reflectionReminder: string | null;
};

/** Everything the user owns. This is exactly what export/import carries. */
export type Data = {
  habits: Habit[];
  /** habit id -> sorted unique days checked in */
  checkins: Record<string, DayKey[]>;
  /** habit id -> sorted unique days frozen */
  freezes: Record<string, DayKey[]>;
  sessions: FocusSession[];
  reflections: Record<DayKey, Reflection>;
  settings: Settings;
};

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  haptics: true,
  focusMinutes: 25,
  breakMinutes: 5,
  autoCheckIn: true,
  reflectionReminder: null,
};

export const EMPTY_DATA: Data = {
  habits: [],
  checkins: {},
  freezes: {},
  sessions: [],
  reflections: {},
  settings: DEFAULT_SETTINGS,
};

export const HABIT_COLOR_COUNT = 6;
export const MAX_NAME_LENGTH = 40;
export const MAX_HABITS = 200;
/** Per habit. Bounds the per-day pause lookup; nobody archives and restores a habit 1000 times. */
export const MAX_PAUSES = 1000;
export const MAX_SESSIONS = 50_000;
export const MAX_ANSWER_LENGTH = 1000;
