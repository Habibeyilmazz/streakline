import type { DayKey } from './dates';
import type { Data } from './types';

/** Strict 24-hour 'HH:MM'. */
export function parseTime(s: string): { hour: number; minute: number } | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(s);
  return m ? { hour: +m[1], minute: +m[2] } : null;
}

/**
 * What a person types for a time, as strict 'HH:MM': the leading zero may be
 * missing and the separator may be a dot ('7:30', '7.30'). Null if it is not a time.
 */
export function normalizeTime(input: string): string | null {
  const m = /^(\d{1,2})[:.](\d{2})$/.exec(input.trim());
  const time = m && `${m[1].padStart(2, '0')}:${m[2]}`;
  return time && parseTime(time) ? time : null;
}

export type PlannedReminder = {
  title: string;
  body: string;
  hour: number;
  minute: number;
  /** 0 = Sunday ... 6 = Saturday. Absent means every day. */
  weekday?: number;
  /** Fires once, on this local day, instead of repeating. */
  date?: DayKey;
};

// iOS keeps at most 64 pending local notifications per app; stay under it
// and leave room for the focus timer's own notification.
export const MAX_REMINDERS = 60;

/**
 * Every repeating local notification the app should have scheduled.
 * Reminders fire whether or not the habit is already done that day: the app
 * cannot run in the background to check.
 */
export function reminderPlan(data: Data): PlannedReminder[] {
  return allReminders(data).slice(0, MAX_REMINDERS).map(({ habitId, ...r }) => r);
}

/** Names of habits that lose some or all of their reminders to MAX_REMINDERS. */
export function habitsOverReminderLimit(data: Data): string[] {
  const over = allReminders(data).slice(MAX_REMINDERS);
  return data.habits.filter((h) => over.some((r) => r.habitId === h.id)).map((h) => h.name);
}

function allReminders(data: Data): (PlannedReminder & { habitId?: string })[] {
  const plan: (PlannedReminder & { habitId?: string })[] = [];
  const reflection = data.settings.reflectionReminder && parseTime(data.settings.reflectionReminder);
  if (reflection) plan.push({ title: 'Evening reflection', body: 'Two minutes: three questions about today.', ...reflection });

  for (const h of data.habits) {
    const at = h.reminder && parseTime(h.reminder);
    if (!at) continue;
    if (h.archivedOn) {
      // The app cannot wake itself to restore a paused habit, so one notification says it is back; opening the app restores it.
      if (h.resumeOn) plan.push({ title: h.name, body: 'Your pause is over. Time to check in.', ...at, date: h.resumeOn, habitId: h.id });
      continue;
    }
    const base = { title: h.name, body: 'Time to check in.', ...at, habitId: h.id };
    if (h.schedule.kind === 'weekdays' && h.schedule.days.length < 7) {
      for (const weekday of h.schedule.days) plan.push({ ...base, weekday });
    } else {
      plan.push(base);
    }
  }
  return plan;
}
