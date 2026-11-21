import { DayKey, WEEKDAYS_SHORT, addDays, dayNumber, weekStart, weekday } from './dates';
import type { Data, Habit, Schedule } from './types';

/** The days a habit was checked in and the days it was frozen. */
export type Marks = { done: ReadonlySet<DayKey>; frozen: ReadonlySet<DayKey> };

export function marksOf(data: Data, habitId: string): Marks {
  return { done: new Set(data.checkins[habitId]), frozen: new Set(data.freezes[habitId]) };
}

/** Is the habit expected on this day? "N times a week" habits may be done on any day. */
export function isDue(schedule: Schedule, day: DayKey): boolean {
  return schedule.kind !== 'weekdays' || schedule.days.includes(weekday(day));
}

export function describeSchedule(s: Schedule): string {
  if (s.kind === 'daily') return 'Every day';
  if (s.kind === 'weekly') return s.times === 1 ? 'Once a week' : `${s.times} times a week`;
  if (s.days.length === 7) return 'Every day';
  // Monday first, to match the rest of the app.
  return [1, 2, 3, 4, 5, 6, 0].filter((d) => s.days.includes(d)).map((d) => WEEKDAYS_SHORT[d]).join(', ');
}

export type DayStatus =
  | 'done'
  | 'frozen'
  /** Due, in the past, and neither done nor frozen. */
  | 'missed'
  /** Today, due, not done yet. */
  | 'open'
  /** Not expected that day. */
  | 'rest'
  /** Before the habit existed, after it was archived, or in the future. */
  | 'none';

/** Is the habit archived as of this day? */
export const archivedBy = (habit: Habit, day: DayKey): boolean => habit.archivedOn !== undefined && day >= habit.archivedOn;

export function dayStatus(habit: Habit, day: DayKey, today: DayKey, marks: Marks): DayStatus {
  // A check-in dated after today (made before travelling west) waits until that day arrives.
  if (day > today) return 'none';
  if (marks.done.has(day)) return 'done';
  if (day < habit.createdOn || archivedBy(habit, day)) return 'none';
  if (marks.frozen.has(day)) return 'frozen';
  if (!isDue(habit.schedule, day)) return 'rest';
  if (day === today) return 'open';
  // With "N times a week" no single day is ever missed, only a whole week.
  return habit.schedule.kind === 'weekly' ? 'rest' : 'missed';
}

/**
 * What the Today list should ask for: 'due' means it still wants a check-in
 * today. An "N times a week" habit stops being due once the week reached N,
 * and a frozen day asks for nothing.
 */
export function todayState(habit: Habit, today: DayKey, marks: Marks): 'done' | 'due' | 'off' {
  const status = dayStatus(habit, today, today, marks);
  if (status === 'done') return 'done';
  if (status !== 'open') return 'off';
  if (habit.schedule.kind !== 'weekly') return 'due';
  const monday = weekStart(today);
  const thisWeek = [...marks.done, ...marks.frozen].filter((d) => d >= monday && d <= today).length;
  return thisWeek >= habit.schedule.times ? 'off' : 'due';
}

export type Streak = { current: number; best: number; unit: 'day' | 'week' };

/**
 * Day-based habits (daily, specific weekdays): the streak is the number of
 * check-ins in the current unbroken run. A due day that was neither checked in
 * nor frozen breaks it. Rest days and frozen days bridge the run without
 * adding to it. Today never breaks a streak: it is still open.
 *
 * "N times a week" habits: the streak is the number of consecutive
 * Monday-to-Sunday weeks that reached N (a frozen day counts towards N).
 * The current week counts once it reaches N and never breaks the streak early.
 * A habit's first week only asks for as many days as were left in it.
 */
export function streak(habit: Habit, marks: Marks, today: DayKey): Streak {
  const done = new Set([...marks.done].map(dayNumber));
  const frozen = new Set([...marks.frozen].map(dayNumber));
  // An archived habit's streak stops where it was archived.
  const end = dayNumber(archivedBy(habit, today) ? habit.archivedOn! : today);
  // Backfilled check-ins may predate the habit's creation day.
  const start = Math.min(dayNumber(habit.createdOn), ...done);
  const s = habit.schedule;
  let run = 0;
  let best = 0;

  if (s.kind === 'weekly') {
    // Day 0 (1970-01-01) was a Thursday, so (n + 3) % 7 is days since Monday.
    for (let w = start - ((start + 3) % 7); w <= end; w += 7) {
      let kept = 0;
      for (let n = w; n < w + 7 && n <= end; n++) if (done.has(n) || frozen.has(n)) kept++;
      // The habit's first week may be too short to fit all N.
      if (kept >= Math.min(s.times, w + 7 - start)) best = Math.max(best, ++run);
      else if (w + 7 <= end) run = 0; // that week is over and fell short
    }
    return { current: run, best, unit: 'week' };
  }

  for (let n = start; n <= end; n++) {
    if (done.has(n)) best = Math.max(best, ++run);
    else if (n < end && !frozen.has(n) && (s.kind === 'daily' || s.days.includes((n + 4) % 7))) run = 0;
  }
  return { current: run, best, unit: 'day' };
}

export const FREEZES_PER_MONTH = 2;

/**
 * A freeze excuses one due day so it does not break the streak. Returns null
 * when `day` can be frozen, otherwise the reason it cannot.
 */
export function freezeBlocker(habit: Habit, day: DayKey, today: DayKey, marks: Marks): string | null {
  if (day !== today && day !== addDays(today, -1)) return 'Only today or yesterday can be frozen.';
  if (day < habit.createdOn) return 'The habit did not exist yet.';
  if (archivedBy(habit, day)) return 'The habit is archived.';
  if (marks.done.has(day)) return 'That day is already checked in.';
  if (marks.frozen.has(day)) return 'That day is already frozen.';
  if (!isDue(habit.schedule, day)) return 'Nothing was due that day.';
  const month = day.slice(0, 7);
  const used = [...marks.frozen].filter((d) => d.startsWith(month)).length;
  if (used >= FREEZES_PER_MONTH) return `Both freezes for this month are used.`;
  return null;
}
