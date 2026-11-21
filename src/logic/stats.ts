import { DayKey, addDays, eachDay, weekStart } from './dates';
import { DayStatus, archivedBy, dayStatus, marksOf } from './streaks';
import type { Data, Habit } from './types';

export type HabitWeek = {
  habit: Habit;
  /** Monday to Sunday. */
  days: DayStatus[];
  /** Check-ins that counted. For "N times a week" this is capped at N. */
  done: number;
  /** What was asked of you this week, after removing frozen days. */
  due: number;
  missed: number;
  frozen: number;
  focusMinutes: number;
};

export type WeekReview = {
  start: DayKey;
  end: DayKey;
  /** False while the week is still running (or in the future). */
  over: boolean;
  habits: HabitWeek[];
  done: number;
  due: number;
  missed: number;
  /** due - done - missed: what can still be done before the week ends. */
  open: number;
  frozen: number;
  /** done / due, or null when nothing was due. */
  rate: number | null;
  focusMinutes: number;
  sessions: number;
  /** Days this week with a saved reflection. */
  reflections: number;
};

/**
 * Plain counts for one Monday-to-Sunday week. Nothing is rounded in your
 * favour: frozen days are not counted as done, and extra check-ins beyond
 * what was due cannot push the rate above 100%.
 */
export function weekReview(data: Data, start: DayKey, today: DayKey): WeekReview {
  const end = addDays(start, 6);
  const days = eachDay(start, end);
  const over = end < today;

  const habits: HabitWeek[] = [];
  for (const habit of data.habits) {
    const marks = marksOf(data, habit.id);
    const statuses = days.map((d) => dayStatus(habit, d, today, marks));
    const count = (s: DayStatus) => statuses.filter((x) => x === s).length;
    const checked = count('done');
    if ((habit.createdOn > end || archivedBy(habit, start)) && checked === 0) continue; // not part of this week

    let done: number, due: number, missed: number, frozen: number;
    if (habit.schedule.kind === 'weekly') {
      // The first week of a habit, or the week it was archived, may be too short to fit all N.
      const available = days.filter((d) => d >= habit.createdOn && !archivedBy(habit, d)).length;
      const target = Math.min(habit.schedule.times, Math.max(available, checked));
      done = Math.min(checked, target);
      frozen = Math.min(count('frozen'), target - done);
      due = target - frozen;
      missed = over ? due - done : 0;
      if (start > today) due = done; // a future week asks nothing yet
    } else {
      done = checked;
      missed = count('missed');
      frozen = count('frozen');
      due = done + missed + count('open');
    }
    const focusMinutes = data.sessions
      .filter((s) => s.habitId === habit.id && s.day >= start && s.day <= end)
      .reduce((sum, s) => sum + s.minutes, 0);
    habits.push({ habit, days: statuses, done, due, missed, frozen, focusMinutes });
  }

  const sum = (f: (h: HabitWeek) => number) => habits.reduce((n, h) => n + f(h), 0);
  const done = sum((h) => h.done);
  const due = sum((h) => h.due);
  const missed = sum((h) => h.missed);
  const weekSessions = data.sessions.filter((s) => s.day >= start && s.day <= end);
  return {
    start,
    end,
    over,
    habits,
    done,
    due,
    missed,
    open: due - done - missed,
    frozen: sum((h) => h.frozen),
    rate: due > 0 ? done / due : null,
    focusMinutes: weekSessions.reduce((n, s) => n + s.minutes, 0),
    sessions: weekSessions.length,
    reflections: days.filter((d) => data.reflections[d]).length,
  };
}

/** Columns of Monday-to-Sunday weeks, oldest first, ending with today's week. */
export function yearGrid(today: DayKey, weeks = 53): DayKey[][] {
  const last = weekStart(today);
  return Array.from({ length: weeks }, (_, i) => {
    const monday = addDays(last, (i - weeks + 1) * 7);
    return eachDay(monday, addDays(monday, 6));
  });
}

/**
 * How much of what was due on each day got done, across all habits:
 * 0 = nothing done (or nothing due), 4 = everything done.
 */
export function dayLevels(data: Data, days: DayKey[], today: DayKey): Map<DayKey, 0 | 1 | 2 | 3 | 4> {
  const all = data.habits.map((habit) => ({ habit, marks: marksOf(data, habit.id) }));
  const out = new Map<DayKey, 0 | 1 | 2 | 3 | 4>();
  for (const day of days) {
    let done = 0;
    let due = 0;
    for (const { habit, marks } of all) {
      const s = dayStatus(habit, day, today, marks);
      if (s === 'done') done++;
      // An unchecked "N times a week" day is not a miss, so it is not counted as due.
      if (s === 'done' || s === 'missed' || (s === 'open' && habit.schedule.kind !== 'weekly')) due++;
    }
    const ratio = due === 0 ? 0 : done / due;
    out.set(day, ratio === 0 ? 0 : ratio < 1 / 3 ? 1 : ratio < 2 / 3 ? 2 : ratio < 1 ? 3 : 4);
  }
  return out;
}

/** Check-ins in the Monday-to-Sunday week containing `day`. */
export function weekCount(checkins: readonly DayKey[] | undefined, day: DayKey): number {
  const start = weekStart(day);
  const end = addDays(start, 6);
  return (checkins ?? []).filter((d) => d >= start && d <= end).length;
}
