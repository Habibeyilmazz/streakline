import { addDays, dayKey, dayNumber, eachDay, isDayKey, rangeLabel, weekStart, weekday } from './dates';

// `npm run test:zones` runs this file under several TZ values; every test
// here must hold in all of them.
const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const inZone = (tz: string) => (zone === tz ? test : test.skip);

describe('dayKey', () => {
  test('is the local calendar date, right up to midnight', () => {
    expect(dayKey(new Date(2026, 10, 21, 0, 0, 0))).toBe('2026-11-21');
    expect(dayKey(new Date(2026, 10, 21, 23, 59, 59, 999))).toBe('2026-11-21');
    expect(dayKey(new Date(2026, 10, 22, 0, 0, 0))).toBe('2026-11-22');
  });

  test('pads months and days', () => {
    expect(dayKey(new Date(2026, 0, 5, 12))).toBe('2026-01-05');
  });

  inZone('America/New_York')('one instant is two different days in two zones', () => {
    // 03:30 UTC on the 22nd is still 22:30 on the 21st in New York (UTC-5).
    const instant = new Date('2026-11-22T03:30:00Z');
    expect(dayKey(instant)).toBe('2026-11-21');
    expect(instant.toISOString().slice(0, 10)).toBe('2026-11-22');
  });

  inZone('America/New_York')('spring forward: the 23-hour day keeps its own key', () => {
    // 2026-03-08, clocks jump 02:00 -> 03:00.
    expect(dayKey(new Date(2026, 2, 8, 1, 59))).toBe('2026-03-08');
    expect(dayKey(new Date(2026, 2, 8, 3, 0))).toBe('2026-03-08');
    // 24 hours after noon on the 7th is 13:00 on the 8th, not the 9th.
    expect(dayKey(new Date(new Date(2026, 2, 7, 12).getTime() + 86_400_000))).toBe('2026-03-08');
  });

  inZone('America/New_York')('fall back: the 25-hour day is still one day', () => {
    // 2026-11-01, 01:00-02:00 happens twice.
    const start = new Date(2026, 10, 1, 0, 30).getTime();
    for (let h = 0; h < 24; h++) expect(dayKey(new Date(start + h * 3_600_000))).toBe('2026-11-01');
    expect(dayKey(new Date(start + 24 * 3_600_000))).toBe('2026-11-01'); // 23:30, an hour "late"
    expect(dayKey(new Date(start + 25 * 3_600_000))).toBe('2026-11-02');
  });

  inZone('Pacific/Auckland')('southern-hemisphere DST (UTC+13 in summer)', () => {
    // 2026-09-27, clocks jump 02:00 -> 03:00 in New Zealand.
    expect(dayKey(new Date(2026, 8, 27, 3, 30))).toBe('2026-09-27');
    expect(dayKey(new Date('2026-12-31T11:30:00Z'))).toBe('2027-01-01');
  });

  inZone('Asia/Kolkata')('half-hour offsets', () => {
    expect(dayKey(new Date('2026-11-21T18:29:59Z'))).toBe('2026-11-21');
    expect(dayKey(new Date('2026-11-21T18:30:00Z'))).toBe('2026-11-22');
  });
});

describe('day arithmetic never depends on the clock', () => {
  test('addDays crosses DST dates, month ends and leap days', () => {
    expect(addDays('2026-03-07', 1)).toBe('2026-03-08'); // US spring forward
    expect(addDays('2026-03-08', 1)).toBe('2026-03-09');
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01'); // US fall back
    expect(addDays('2026-11-01', 1)).toBe('2026-11-02');
    expect(addDays('2026-03-29', -1)).toBe('2026-03-28'); // EU spring forward
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDays('2026-01-01', 365)).toBe('2027-01-01');
  });

  test('a whole year of single steps visits every date exactly once', () => {
    let k = '2026-01-01';
    const seen = new Set<string>();
    for (let i = 0; i < 365; i++) {
      seen.add(k);
      k = addDays(k, 1);
    }
    expect(seen.size).toBe(365);
    expect(k).toBe('2027-01-01');
  });

  test('weekday matches the real calendar', () => {
    expect(weekday('1970-01-01')).toBe(4); // Thursday
    expect(weekday('2026-11-21')).toBe(6); // Saturday
    expect(weekday('2026-11-22')).toBe(0); // Sunday
    expect(weekday('2026-11-23')).toBe(1); // Monday
    for (const k of eachDay('2026-01-01', '2026-12-31')) {
      expect(weekday(k)).toBe(new Date(`${k}T12:00:00Z`).getUTCDay());
    }
  });

  test('weekStart is the Monday on or before', () => {
    expect(weekStart('2026-11-23')).toBe('2026-11-23');
    expect(weekStart('2026-11-21')).toBe('2026-11-16');
    expect(weekStart('2026-11-22')).toBe('2026-11-16'); // Sunday belongs to the week before
    expect(weekStart('2027-01-01')).toBe('2026-12-28'); // across a year boundary
  });

  test('eachDay is inclusive and empty when reversed', () => {
    expect(eachDay('2026-02-27', '2026-03-01')).toEqual(['2026-02-27', '2026-02-28', '2026-03-01']);
    expect(eachDay('2026-03-01', '2026-03-01')).toEqual(['2026-03-01']);
    expect(eachDay('2026-03-02', '2026-03-01')).toEqual([]);
  });

  test('dayNumber is consistent with addDays', () => {
    expect(dayNumber('1970-01-01')).toBe(0);
    expect(dayNumber(addDays('2026-11-21', 40))).toBe(dayNumber('2026-11-21') + 40);
    expect(dayNumber('2025-01-01') - dayNumber('2024-01-01')).toBe(366); // leap year
  });
});

describe('isDayKey', () => {
  test.each(['2026-11-21', '2028-02-29', '2000-01-01'])('accepts %s', (k) => expect(isDayKey(k)).toBe(true));
  test.each(['2026-02-30', '2026-13-01', '2027-02-29', '2026-1-1', '2026-11-21T00:00', '', 'today', null, 20261121, undefined])(
    'rejects %p',
    (k) => expect(isDayKey(k)).toBe(false),
  );
});

test('rangeLabel', () => {
  expect(rangeLabel('2026-11-16', '2026-11-22')).toBe('16 to 22 Nov');
  expect(rangeLabel('2026-11-30', '2026-12-06')).toBe('30 Nov to 6 Dec');
});
