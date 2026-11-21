import { MAX_REMINDERS, normalizeTime, parseTime, reminderPlan } from './reminders';
import { formatClock, isFinished, pauseTimer, remainingMs, resumeTimer, startTimer, validateTimer } from './timer';
import { DEFAULT_SETTINGS, Data, Habit } from './types';

describe('parseTime', () => {
  test.each([['00:00', 0, 0], ['07:05', 7, 5], ['23:59', 23, 59]])('%s', (s, hour, minute) => expect(parseTime(s)).toEqual({ hour, minute }));
  test.each(['24:00', '7:05', '07:60', '0705', '07:05:00', ' 07:05', ''])('rejects %p', (s) => expect(parseTime(s)).toBeNull());
});

describe('normalizeTime', () => {
  test.each([['07:30', '07:30'], ['7:30', '07:30'], ['7.30', '07:30'], ['21.00', '21:00'], [' 0:05 ', '00:05'], ['23:59', '23:59']])('%p -> %s', (typed, stored) =>
    expect(normalizeTime(typed)).toBe(stored));
  test.each(['', '7', '730', '24:00', '7:60', '7:5', '7:300', '9pm', '07:30:00', '-7:30'])('rejects %p', (typed) => expect(normalizeTime(typed)).toBeNull());
  test('no prefix of a time is itself a time, so a field can save as you type', () => {
    for (const typed of ['7:30', '21:00', '21.00']) {
      for (let n = 1; n < typed.length; n++) expect(normalizeTime(typed.slice(0, n))).toBeNull();
    }
  });
});

describe('reminderPlan', () => {
  const h = (patch: Partial<Habit>): Habit => ({ id: 'h', name: 'Read', color: 0, schedule: { kind: 'daily' }, createdOn: '2026-01-01', reminder: '07:30', ...patch });
  const data = (habits: Habit[], reflectionReminder: string | null = null): Data => ({
    habits, checkins: {}, freezes: {}, sessions: [], reflections: {}, settings: { ...DEFAULT_SETTINGS, reflectionReminder },
  });

  test('nothing set, nothing planned', () => {
    expect(reminderPlan(data([h({ reminder: null })]))).toEqual([]);
  });
  test('a daily habit gets one daily reminder', () => {
    expect(reminderPlan(data([h({})]))).toEqual([{ title: 'Read', body: 'Time to check in.', hour: 7, minute: 30 }]);
  });
  test('specific weekdays get one reminder per day', () => {
    const plan = reminderPlan(data([h({ schedule: { kind: 'weekdays', days: [1, 5] } })]));
    expect(plan.map((p) => p.weekday)).toEqual([1, 5]);
  });
  test('N times a week reminds every day', () => {
    expect(reminderPlan(data([h({ schedule: { kind: 'weekly', times: 3 } })]))).toHaveLength(1);
  });
  test('the reflection reminder comes first and survives the cap', () => {
    const many = Array.from({ length: 20 }, (_, i) => h({ id: `h${i}`, schedule: { kind: 'weekdays', days: [1, 2, 3, 4, 5, 6] } }));
    const plan = reminderPlan(data(many, '21:00'));
    expect(plan).toHaveLength(MAX_REMINDERS);
    expect(plan[0]).toMatchObject({ title: 'Evening reflection', hour: 21, minute: 0 });
  });
});

describe('timer', () => {
  const T0 = 1_800_000_000_000;
  const t = startTimer('focus', 25, 'h', T0);

  test('counts down from the end time, however late anyone looks', () => {
    expect(remainingMs(t, T0)).toBe(25 * 60_000);
    expect(remainingMs(t, T0 + 60_000)).toBe(24 * 60_000);
    expect(remainingMs(t, T0 + 3 * 3_600_000)).toBe(0); // app was suspended for hours
    expect(isFinished(t, T0 + 25 * 60_000 - 1)).toBe(false);
    expect(isFinished(t, T0 + 25 * 60_000)).toBe(true);
  });

  test('pause holds the remaining time; resume moves the end', () => {
    const paused = pauseTimer(t, T0 + 10 * 60_000);
    expect(remainingMs(paused, T0 + 99 * 60_000)).toBe(15 * 60_000);
    expect(isFinished(paused, T0 + 99 * 60_000)).toBe(false);
    const resumed = resumeTimer(paused, T0 + 60 * 60_000);
    expect(resumed.endsAt).toBe(T0 + 75 * 60_000);
    expect(resumeTimer(resumed, T0 + 61 * 60_000)).toBe(resumed); // already running
  });

  test('formatClock rounds up to the next second', () => {
    expect(formatClock(25 * 60_000)).toBe('25:00');
    expect(formatClock(25 * 60_000 - 1)).toBe('25:00');
    expect(formatClock(61_000)).toBe('01:01');
    expect(formatClock(1)).toBe('00:01');
    expect(formatClock(0)).toBe('00:00');
    expect(formatClock(-5)).toBe('00:00');
    expect(formatClock(90 * 60_000)).toBe('90:00');
  });

  test('validateTimer restores a saved timer and refuses junk', () => {
    expect(validateTimer(JSON.parse(JSON.stringify(t)))).toEqual(t);
    expect(validateTimer(pauseTimer(t, T0 + 1000))).toEqual(pauseTimer(t, T0 + 1000));
    for (const junk of [null, 'x', {}, { ...t, kind: 'nap' }, { ...t, minutes: 0 }, { ...t, endsAt: 'soon' }, { ...t, habitId: 3 }, { ...t, remainingMs: -1 }]) {
      expect(validateTimer(junk)).toBeNull();
    }
  });
});
