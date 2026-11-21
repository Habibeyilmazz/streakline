import { dayLevels, weekCount, weekReview, yearGrid } from './stats';
import { DEFAULT_SETTINGS, Data, Habit, Schedule } from './types';

const habit = (id: string, schedule: Schedule, createdOn = '2026-01-01'): Habit => ({ id, name: id, color: 0, schedule, createdOn, reminder: null });
const data = (habits: Habit[], checkins: Record<string, string[]> = {}, extra: Partial<Data> = {}): Data => ({
  habits,
  checkins,
  freezes: {},
  sessions: [],
  reflections: {},
  settings: DEFAULT_SETTINGS,
  ...extra,
});
const MON = '2026-11-16';

describe('weekReview', () => {
  test('a finished week of a daily habit: done, missed and frozen are separate', () => {
    const d = data([habit('read', { kind: 'daily' })], { read: ['2026-11-16', '2026-11-17', '2026-11-19', '2026-11-22'] }, { freezes: { read: ['2026-11-18'] } });
    const r = weekReview(d, MON, '2026-11-25');
    expect(r.over).toBe(true);
    expect(r.habits[0].days).toEqual(['done', 'done', 'frozen', 'done', 'missed', 'missed', 'done']);
    expect(r).toMatchObject({ done: 4, due: 6, missed: 2, frozen: 1, open: 0 });
    expect(r.rate).toBeCloseTo(4 / 6);
  });

  test('the running week only counts days up to today, and today is open, not missed', () => {
    const d = data([habit('read', { kind: 'daily' })], { read: ['2026-11-16', '2026-11-18'] });
    const r = weekReview(d, MON, '2026-11-19'); // Thursday
    expect(r.over).toBe(false);
    expect(r).toMatchObject({ done: 2, due: 4, missed: 1, open: 1 });
    expect(r.habits[0].days).toEqual(['done', 'missed', 'done', 'open', 'none', 'none', 'none']);
  });

  test('specific weekdays: rest days are not due; an extra check-in cannot exceed 100%', () => {
    const d = data([habit('gym', { kind: 'weekdays', days: [1, 3, 5] })], { gym: ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-20'] });
    const r = weekReview(d, MON, '2026-11-25');
    expect(r).toMatchObject({ done: 4, due: 4, missed: 0, rate: 1 });
  });

  test('N times a week: target is N, extra check-ins are capped, shortfall is missed once the week ends', () => {
    const h = habit('run', { kind: 'weekly', times: 3 });
    const over = weekReview(data([h], { run: ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19'] }), MON, '2026-11-25');
    expect(over).toMatchObject({ done: 3, due: 3, missed: 0, rate: 1 });
    const short = weekReview(data([h], { run: ['2026-11-16'] }), MON, '2026-11-25');
    expect(short).toMatchObject({ done: 1, due: 3, missed: 2, open: 0 });
    const running = weekReview(data([h], { run: ['2026-11-16'] }), MON, '2026-11-18');
    expect(running).toMatchObject({ done: 1, due: 3, missed: 0, open: 2 });
  });

  test('N times a week: a freeze lowers the target instead of counting as done', () => {
    const h = habit('run', { kind: 'weekly', times: 3 });
    const r = weekReview(data([h], { run: ['2026-11-16', '2026-11-17'] }, { freezes: { run: ['2026-11-19'] } }), MON, '2026-11-25');
    expect(r).toMatchObject({ done: 2, due: 2, missed: 0, frozen: 1, rate: 1 });
  });

  test('N times a week: a habit created late in the week is not asked for more days than were left', () => {
    const h = habit('run', { kind: 'weekly', times: 5 }, '2026-11-21'); // Saturday: two days left
    const r = weekReview(data([h], { run: ['2026-11-21'] }), MON, '2026-11-25');
    expect(r).toMatchObject({ done: 1, due: 2, missed: 1 });
  });

  test('a habit created mid-week is only due from its first day', () => {
    const h = habit('read', { kind: 'daily' }, '2026-11-20');
    const r = weekReview(data([h], { read: ['2026-11-20'] }), MON, '2026-11-25');
    expect(r).toMatchObject({ done: 1, due: 3, missed: 2 });
    expect(r.habits[0].days.slice(0, 4)).toEqual(['none', 'none', 'none', 'none']);
  });

  test('habits that did not exist yet are left out; a future week asks nothing', () => {
    const d = data([habit('later', { kind: 'daily' }, '2026-12-01'), habit('run', { kind: 'weekly', times: 3 })]);
    expect(weekReview(d, MON, '2026-12-05').habits.map((h) => h.habit.id)).toEqual(['run']);
    const future = weekReview(d, '2026-12-14', '2026-12-05');
    expect(future).toMatchObject({ done: 0, due: 0, missed: 0, open: 0, rate: null, over: false });
  });

  test('nothing due gives a null rate, not 0% or 100%', () => {
    expect(weekReview(data([]), MON, '2026-11-25').rate).toBeNull();
  });

  test('focus minutes and reflections are counted within the week only', () => {
    const d = data([habit('read', { kind: 'daily' })], {}, {
      sessions: [
        { id: 'a', habitId: 'read', day: '2026-11-15', minutes: 25 }, // Sunday before
        { id: 'b', habitId: 'read', day: '2026-11-16', minutes: 25 },
        { id: 'c', habitId: null, day: '2026-11-22', minutes: 50 },
        { id: 'd', habitId: 'read', day: '2026-11-23', minutes: 25 }, // Monday after
      ],
      reflections: { '2026-11-15': { answers: ['a', '', ''] }, '2026-11-16': { answers: ['a', '', ''] }, '2026-11-22': { answers: ['', 'b', ''] } },
    });
    const r = weekReview(d, MON, '2026-11-25');
    expect(r).toMatchObject({ focusMinutes: 75, sessions: 2, reflections: 2 });
    expect(r.habits[0].focusMinutes).toBe(25);
  });
});

describe('yearGrid', () => {
  test('53 Monday-first weeks ending with the current week', () => {
    const grid = yearGrid('2026-11-21');
    expect(grid).toHaveLength(53);
    expect(grid.every((w) => w.length === 7)).toBe(true);
    expect(grid[52]).toEqual(['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22']);
    expect(grid[0][0]).toBe('2025-11-17');
    expect(new Set(grid.flat()).size).toBe(371);
  });
});

describe('dayLevels', () => {
  const d = data(
    [habit('a', { kind: 'daily' }), habit('b', { kind: 'daily' }), habit('c', { kind: 'daily' }), habit('w', { kind: 'weekly', times: 2 })],
    { a: ['2026-11-16', '2026-11-17', '2026-11-18'], b: ['2026-11-17', '2026-11-18'], c: ['2026-11-18'], w: ['2026-11-19'] },
  );
  const levels = dayLevels(d, ['2026-11-15', '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21'], '2026-11-20');
  test('levels follow the share of due habits done', () => {
    expect(levels.get('2026-11-15')).toBe(0); // 0 of 3
    expect(levels.get('2026-11-16')).toBe(2); // 1 of 3
    expect(levels.get('2026-11-17')).toBe(3); // 2 of 3
    expect(levels.get('2026-11-18')).toBe(4); // 3 of 3
    expect(levels.get('2026-11-19')).toBe(1); // only the weekly one: 1 of 4
    expect(levels.get('2026-11-20')).toBe(0); // today, nothing yet
    expect(levels.get('2026-11-21')).toBe(0); // future
  });
});

test('weekCount counts check-ins from Monday to Sunday', () => {
  const days = ['2026-11-15', '2026-11-16', '2026-11-22', '2026-11-23'];
  expect(weekCount(days, '2026-11-18')).toBe(2);
  expect(weekCount(undefined, '2026-11-18')).toBe(0);
});

describe('archived habits in the review', () => {
  test('weeks after the archive date leave the habit out; the week it was archived counts only the days before', () => {
    const read = { ...habit('read', { kind: 'daily' }), archivedOn: '2026-11-19' }; // Thursday
    const d = data([read], { read: ['2026-11-16', '2026-11-17'] });
    const r = weekReview(d, MON, '2026-11-25');
    expect(r.habits[0].days).toEqual(['done', 'done', 'missed', 'none', 'none', 'none', 'none']);
    expect(r).toMatchObject({ done: 2, due: 3, missed: 1 });
    expect(weekReview(d, '2026-11-23', '2026-11-25').habits).toEqual([]);
    // History before archiving is untouched.
    expect(weekReview(d, '2026-11-09', '2026-11-25').habits[0]).toMatchObject({ due: 7, missed: 7 });
  });

  test('N times a week: the archive week asks only for the days that were left', () => {
    const run = { ...habit('run', { kind: 'weekly', times: 3 }), archivedOn: '2026-11-18' }; // Wednesday: two days left
    const r = weekReview(data([run], { run: ['2026-11-16'] }), MON, '2026-11-25');
    expect(r).toMatchObject({ done: 1, due: 2, missed: 1 });
  });

  test('the all-habits heatmap does not count an archived habit after its archive date', () => {
    const read = { ...habit('read', { kind: 'daily' }), archivedOn: '2026-11-19' };
    const gym = habit('gym', { kind: 'daily' });
    const levels = dayLevels(data([read, gym], { gym: ['2026-11-20'] }), ['2026-11-18', '2026-11-20'], '2026-11-21');
    expect(levels.get('2026-11-18')).toBe(0);
    expect(levels.get('2026-11-20')).toBe(4); // read no longer due
  });
});
