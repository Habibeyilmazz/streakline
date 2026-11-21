import { addDays, eachDay } from './dates';
import { FREEZES_PER_MONTH, Marks, dayStatus, describeSchedule, freezeBlocker, isDue, streak, todayState } from './streaks';
import type { Habit, Schedule } from './types';

const habit = (schedule: Schedule, createdOn = '2026-01-01'): Habit => ({ id: 'h', name: 'Read', color: 0, schedule, createdOn, reminder: null });
const marks = (done: string[] = [], frozen: string[] = []): Marks => ({ done: new Set(done), frozen: new Set(frozen) });
const daily = habit({ kind: 'daily' });
// 2026-11-16 is a Monday; 2026-11-21 a Saturday.
const TODAY = '2026-11-21';

describe('daily streak', () => {
  test('no check-ins', () => {
    expect(streak(daily, marks(), TODAY)).toEqual({ current: 0, best: 0, unit: 'day' });
  });

  test('counts consecutive days ending today', () => {
    expect(streak(daily, marks(eachDay('2026-11-17', TODAY)), TODAY).current).toBe(5);
  });

  test('today not done yet does not break it', () => {
    expect(streak(daily, marks(eachDay('2026-11-17', '2026-11-20')), TODAY).current).toBe(4);
  });

  test('yesterday missed breaks it, even if today is done', () => {
    expect(streak(daily, marks([...eachDay('2026-11-10', '2026-11-19'), TODAY]), TODAY)).toEqual({ current: 1, best: 10, unit: 'day' });
  });

  test('yesterday missed and today open means zero', () => {
    expect(streak(daily, marks(eachDay('2026-11-10', '2026-11-19')), TODAY).current).toBe(0);
  });

  test('best remembers an older, longer run', () => {
    const s = streak(daily, marks([...eachDay('2026-03-01', '2026-03-30'), ...eachDay('2026-11-19', TODAY)]), TODAY);
    expect(s).toEqual({ current: 3, best: 30, unit: 'day' });
  });

  test('runs straight through DST changes and a year boundary', () => {
    const h = habit({ kind: 'daily' }, '2025-01-01');
    // Covers US/EU spring forward and fall back in 2025 and 2026.
    expect(streak(h, marks(eachDay('2025-03-01', TODAY)), TODAY).current).toBe(631);
  });

  test('order and duplicates in the input do not matter', () => {
    const days = ['2026-11-21', '2026-11-19', '2026-11-20', '2026-11-20'];
    expect(streak(daily, marks(days), TODAY).current).toBe(3);
  });

  test('check-ins dated after today are ignored until that day arrives', () => {
    // Checked in on the 22nd, then flew west to a zone where it is still the 21st.
    const m = marks(['2026-11-20', '2026-11-21', '2026-11-22']);
    expect(streak(daily, m, '2026-11-21').current).toBe(2);
    expect(streak(daily, m, '2026-11-22').current).toBe(3);
  });

  test('a calendar day skipped by crossing the date line is a missed day', () => {
    // Local dates went 20th -> 22nd; the 21st never happened for this traveller.
    const m = marks(['2026-11-19', '2026-11-20', '2026-11-22']);
    expect(streak(daily, m, '2026-11-22').current).toBe(1);
    // ...which is what a freeze is for.
    expect(streak(daily, marks([...m.done], ['2026-11-21']), '2026-11-22').current).toBe(3);
  });

  test('check-ins backfilled before the creation day count', () => {
    const h = habit({ kind: 'daily' }, '2026-11-20');
    expect(streak(h, marks(eachDay('2026-11-15', TODAY)), TODAY).current).toBe(7);
  });

  test('days before the habit existed are not misses', () => {
    const h = habit({ kind: 'daily' }, TODAY);
    expect(streak(h, marks([TODAY]), TODAY)).toEqual({ current: 1, best: 1, unit: 'day' });
  });
});

describe('freezes', () => {
  test('a frozen day bridges the streak without adding to it', () => {
    const m = marks(['2026-11-17', '2026-11-18', '2026-11-20', TODAY], ['2026-11-19']);
    expect(streak(daily, m, TODAY).current).toBe(4);
  });

  test('two missed days with only one frozen still break it', () => {
    const m = marks(['2026-11-16', '2026-11-17', '2026-11-20', TODAY], ['2026-11-18']);
    expect(streak(daily, m, TODAY).current).toBe(2);
  });

  test('a frozen day alone is not a streak', () => {
    expect(streak(daily, marks([], ['2026-11-20']), TODAY).current).toBe(0);
  });

  test('freezing yesterday the morning after rescues the streak', () => {
    const done = eachDay('2026-11-10', '2026-11-19');
    expect(streak(daily, marks(done), TODAY).current).toBe(0);
    expect(streak(daily, marks(done, ['2026-11-20']), TODAY).current).toBe(10);
  });

  describe('freezeBlocker', () => {
    test('allows today and yesterday when due and unmarked', () => {
      expect(freezeBlocker(daily, TODAY, TODAY, marks())).toBeNull();
      expect(freezeBlocker(daily, '2026-11-20', TODAY, marks())).toBeNull();
    });
    test('refuses older days and the future', () => {
      expect(freezeBlocker(daily, '2026-11-19', TODAY, marks())).toMatch(/today or yesterday/);
      expect(freezeBlocker(daily, '2026-11-22', TODAY, marks())).toMatch(/today or yesterday/);
    });
    test('refuses a day that is done or already frozen', () => {
      expect(freezeBlocker(daily, TODAY, TODAY, marks([TODAY]))).toMatch(/checked in/);
      expect(freezeBlocker(daily, TODAY, TODAY, marks([], [TODAY]))).toMatch(/already frozen/);
    });
    test('refuses a rest day', () => {
      const weekdaysOnly = habit({ kind: 'weekdays', days: [1, 2, 3, 4, 5] });
      expect(freezeBlocker(weekdaysOnly, TODAY, TODAY, marks())).toMatch(/Nothing was due/);
    });
    test('refuses the day before the habit was created', () => {
      expect(freezeBlocker(habit({ kind: 'daily' }, TODAY), '2026-11-20', TODAY, marks())).toMatch(/did not exist/);
    });
    test(`allows ${FREEZES_PER_MONTH} per calendar month, and the count resets with the month`, () => {
      expect(freezeBlocker(daily, TODAY, TODAY, marks([], ['2026-11-03']))).toBeNull();
      expect(freezeBlocker(daily, TODAY, TODAY, marks([], ['2026-11-03', '2026-11-09']))).toMatch(/month are used/);
      // On 1 December, November's freezes no longer count...
      expect(freezeBlocker(daily, '2026-12-01', '2026-12-01', marks([], ['2026-11-03', '2026-11-09']))).toBeNull();
      // ...but freezing 30 November from 1 December still uses November's allowance.
      expect(freezeBlocker(daily, '2026-11-30', '2026-12-01', marks([], ['2026-11-03', '2026-11-09']))).toMatch(/month are used/);
    });
  });
});

describe('specific weekdays', () => {
  const mwf = habit({ kind: 'weekdays', days: [1, 3, 5] }); // Mon, Wed, Fri

  test('isDue', () => {
    expect(isDue(mwf.schedule, '2026-11-16')).toBe(true); // Mon
    expect(isDue(mwf.schedule, '2026-11-17')).toBe(false); // Tue
    expect(isDue({ kind: 'daily' }, '2026-11-17')).toBe(true);
    expect(isDue({ kind: 'weekly', times: 2 }, '2026-11-17')).toBe(true);
  });

  test('rest days do not break the streak', () => {
    const m = marks(['2026-11-09', '2026-11-11', '2026-11-13', '2026-11-16', '2026-11-18', '2026-11-20']);
    expect(streak(mwf, m, TODAY).current).toBe(6); // today (Sat) is a rest day
  });

  test('a missed scheduled day breaks it', () => {
    const m = marks(['2026-11-09', '2026-11-11', '2026-11-16', '2026-11-18', '2026-11-20']); // Fri 13th missed
    expect(streak(mwf, m, TODAY)).toEqual({ current: 3, best: 3, unit: 'day' });
  });

  test('an extra check-in on a rest day adds to the run', () => {
    const m = marks(['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-20']);
    expect(streak(mwf, m, TODAY).current).toBe(4);
  });

  test('a scheduled today that is still open does not break it', () => {
    const m = marks(['2026-11-16', '2026-11-18']);
    expect(streak(mwf, m, '2026-11-20').current).toBe(2);
  });
});

describe('N times a week', () => {
  const three = habit({ kind: 'weekly', times: 3 }, '2026-10-05'); // a Monday

  test('counts consecutive weeks that reached N', () => {
    const m = marks([
      '2026-11-02', '2026-11-04', '2026-11-08', // week of 2 Nov: 3
      '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', // week of 9 Nov: 4
    ]);
    // Current week (16 Nov) has none yet: still open, so the streak stands.
    expect(streak(three, m, TODAY)).toEqual({ current: 2, best: 2, unit: 'week' });
  });

  test('the current week counts as soon as it reaches N', () => {
    const m = marks(['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-16', '2026-11-17', '2026-11-18']);
    expect(streak(three, m, '2026-11-18').current).toBe(2);
  });

  test('a finished week that fell short breaks it', () => {
    const m = marks([
      '2026-10-26', '2026-10-27', '2026-10-28', // 3
      '2026-11-02', '2026-11-03', // 2: short
      '2026-11-09', '2026-11-10', '2026-11-11', // 3
    ]);
    expect(streak(three, m, TODAY)).toEqual({ current: 1, best: 1, unit: 'week' });
  });

  test('Sunday belongs to the week that started the Monday before', () => {
    const m = marks(['2026-11-13', '2026-11-14', '2026-11-15']); // Fri, Sat, Sun
    expect(streak(three, m, '2026-11-16').current).toBe(1);
    // The same three days split across two weeks do not count.
    expect(streak(three, marks(['2026-11-14', '2026-11-15', '2026-11-16']), '2026-11-22').current).toBe(0);
  });

  test('the week is judged on Sunday night, not before', () => {
    const m = marks(['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-16', '2026-11-17']);
    expect(streak(three, m, '2026-11-22').current).toBe(1); // Sunday: week still open
    expect(streak(three, m, '2026-11-23').current).toBe(0); // Monday: last week fell short
  });

  test('a frozen day counts towards the week', () => {
    const m = marks(['2026-11-09', '2026-11-10'], ['2026-11-12']);
    expect(streak(three, m, TODAY).current).toBe(1);
  });

  test('a week spanning a DST change and a year boundary is still seven days', () => {
    const h = habit({ kind: 'weekly', times: 2 }, '2026-10-19');
    // Week of 26 Oct includes the US fall-back date (1 Nov); week of 28 Dec crosses into 2027.
    const m = marks(['2026-10-26', '2026-11-01', '2026-12-28', '2027-01-03']);
    expect(streak(h, m, '2026-11-02').current).toBe(1);
    expect(streak(h, m, '2027-01-04')).toEqual({ current: 1, best: 1, unit: 'week' });
  });

  test('the first week only asks for the days that were left in it', () => {
    const five = habit({ kind: 'weekly', times: 5 }, '2026-11-14'); // created on a Saturday
    expect(streak(five, marks(['2026-11-14', '2026-11-15']), '2026-11-16').current).toBe(1);
    expect(streak(five, marks(['2026-11-14']), '2026-11-16').current).toBe(0);
    // From the second week on, the full five are needed.
    const m = marks(['2026-11-14', '2026-11-15', '2026-11-16', '2026-11-17']);
    expect(streak(five, m, '2026-11-23').current).toBe(0);
  });

  test('once a week', () => {
    const h = habit({ kind: 'weekly', times: 1 }, '2026-10-05');
    const m = marks(['2026-10-11', '2026-10-12', '2026-10-25', '2026-10-26', '2026-11-08', '2026-11-09', '2026-11-21']);
    expect(streak(h, m, TODAY)).toEqual({ current: 7, best: 7, unit: 'week' });
  });
});

describe('dayStatus', () => {
  const mwf = habit({ kind: 'weekdays', days: [1, 3, 5] }, '2026-11-10');
  const m = marks(['2026-11-16', '2026-11-23'], ['2026-11-18']);
  test.each([
    ['2026-11-09', 'none'], // before it existed
    ['2026-11-11', 'missed'], // Wed, due, nothing
    ['2026-11-16', 'done'],
    ['2026-11-17', 'rest'],
    ['2026-11-18', 'frozen'],
    ['2026-11-20', 'open'], // today
    ['2026-11-21', 'none'], // future
    ['2026-11-23', 'none'], // future, even though it is marked done below
  ])('%s is %s', (day, expected) => {
    expect(dayStatus(mwf, day, '2026-11-20', m)).toBe(expected);
  });

  test('an unchecked day of an N-times-a-week habit is never "missed"', () => {
    const h = habit({ kind: 'weekly', times: 3 });
    expect(dayStatus(h, addDays(TODAY, -1), TODAY, marks())).toBe('rest');
    expect(dayStatus(h, TODAY, TODAY, marks())).toBe('open');
  });
});

describe('todayState', () => {
  test('daily: due until checked in', () => {
    expect(todayState(daily, TODAY, marks())).toBe('due');
    expect(todayState(daily, TODAY, marks([TODAY]))).toBe('done');
  });
  test('a rest day or a frozen day asks for nothing', () => {
    expect(todayState(habit({ kind: 'weekdays', days: [1, 3, 5] }), TODAY, marks())).toBe('off'); // Saturday
    expect(todayState(daily, TODAY, marks([], [TODAY]))).toBe('off');
  });
  test('N times a week: due until the week reaches N, then off', () => {
    const three = habit({ kind: 'weekly', times: 3 });
    expect(todayState(three, TODAY, marks(['2026-11-16', '2026-11-17']))).toBe('due');
    expect(todayState(three, TODAY, marks(['2026-11-16', '2026-11-17', '2026-11-19']))).toBe('off');
    // Last week's check-ins do not count towards this week.
    expect(todayState(three, TODAY, marks(['2026-11-13', '2026-11-14', '2026-11-15']))).toBe('due');
    expect(todayState(three, TODAY, marks(['2026-11-16', '2026-11-17', TODAY]))).toBe('done');
    // A frozen day counts towards the week, exactly as it does for the streak.
    expect(todayState(three, TODAY, marks(['2026-11-16', '2026-11-17'], ['2026-11-19']))).toBe('off');
  });
  test('a habit that starts in the future is off', () => {
    expect(todayState(habit({ kind: 'daily' }, '2026-12-01'), TODAY, marks())).toBe('off');
  });
});

test('describeSchedule', () => {
  expect(describeSchedule({ kind: 'daily' })).toBe('Every day');
  expect(describeSchedule({ kind: 'weekdays', days: [0, 1, 5] })).toBe('Mon, Fri, Sun');
  expect(describeSchedule({ kind: 'weekdays', days: [0, 1, 2, 3, 4, 5, 6] })).toBe('Every day');
  expect(describeSchedule({ kind: 'weekly', times: 1 })).toBe('Once a week');
  expect(describeSchedule({ kind: 'weekly', times: 4 })).toBe('4 times a week');
});
