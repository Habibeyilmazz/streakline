import { MAX_BACKUP_CHARS, exportBackup, parseBackup, validateData } from './backup';
import { DEFAULT_SETTINGS, Data } from './types';

const sample: Data = {
  habits: [
    { id: 'h1', name: 'Read', color: 2, schedule: { kind: 'daily' }, createdOn: '2026-10-01', reminder: '07:30' },
    { id: 'h2', name: 'Gym', color: 0, schedule: { kind: 'weekdays', days: [1, 3, 5] }, createdOn: '2026-10-01', reminder: null },
    { id: 'h3', name: 'Run', color: 5, schedule: { kind: 'weekly', times: 3 }, createdOn: '2026-10-05', reminder: null },
  ],
  checkins: { h1: ['2026-11-19', '2026-11-20'], h2: [], h3: ['2026-11-18'] },
  freezes: { h1: ['2026-11-18'], h2: [], h3: [] },
  sessions: [{ id: 's1', habitId: 'h1', day: '2026-11-20', minutes: 25 }],
  reflections: { '2026-11-20': { answers: ['Read on the train', 'Phone', 'Start earlier'] } },
  settings: { ...DEFAULT_SETTINGS, theme: 'dark', reflectionReminder: '21:00' },
};

const wrap = (data: unknown) => JSON.stringify({ app: 'streakline', version: 1, data });
const errorOf = (text: string) => {
  const r = parseBackup(text);
  return r.ok ? null : r.error;
};
const withHabit = (patch: object) => wrap({ ...sample, habits: [{ ...sample.habits[0], ...patch }] });

test('export then import returns exactly the same data', () => {
  const r = parseBackup(exportBackup(sample, new Date('2026-11-21T10:00:00Z')));
  expect(r).toEqual({ ok: true, data: sample });
});

test('days written by a phone whose clock had reset to 1970 can still be loaded', () => {
  const d = validateData({ ...sample, checkins: { h1: ['1970-01-01'] } });
  expect(d.checkins.h1).toEqual(['1970-01-01']);
});

test('the export names the app, a version and a timestamp', () => {
  const file = JSON.parse(exportBackup(sample, new Date('2026-11-21T10:00:00Z')));
  expect(file).toMatchObject({ app: 'streakline', version: 1, exportedAt: '2026-11-21T10:00:00.000Z' });
});

describe('rejects files that are not ours', () => {
  test.each([
    ['not json', 'not valid JSON'],
    ['[]', 'not a Streakline backup'],
    ['{"app":"other","version":1,"data":{}}', 'not a Streakline backup'],
    ['{"app":"streakline","version":2,"data":{}}', 'version 2'],
    ['{"app":"streakline","version":1}', 'does not contain'],
    ['{"app":"streakline","version":1,"data":{}}', 'habits is missing'],
  ])('%s', (text, message) => expect(errorOf(text)).toContain(message));

  test('an oversized file is refused before it is parsed', () => {
    // The picker does not always report a size, so the parser enforces the limit itself.
    const big = `{"app":"streakline","version":1,"data":{"habits":[]},"pad":"${'x'.repeat(MAX_BACKUP_CHARS)}"}`;
    expect(errorOf(big)).toContain('too large');
  });
});

describe('rejects malformed habits', () => {
  test.each([
    [{ name: '   ' }, 'needs a name'],
    [{ name: 'x'.repeat(41) }, 'needs a name'],
    [{ name: 42 }, 'needs a name'],
    [{ color: 6 }, 'colour'],
    [{ color: 1.5 }, 'colour'],
    [{ createdOn: '2026-02-30' }, 'not a valid date'],
    [{ createdOn: '0001-01-01' }, 'not a valid date'],
    [{ createdOn: '2200-01-01' }, 'not a valid date'],
    [{ schedule: { kind: 'hourly' } }, 'unknown schedule'],
    [{ schedule: { kind: 'weekdays', days: [] } }, 'unknown schedule'],
    [{ schedule: { kind: 'weekdays', days: [7] } }, 'weekday'],
    [{ schedule: { kind: 'weekly', times: 0 } }, 'times per week'],
    [{ schedule: { kind: 'weekly', times: 8 } }, 'times per week'],
    [{ reminder: '25:00' }, 'time like'],
    [{ reminder: 730 }, 'time like'],
    [{ archivedOn: '2026-13-01' }, 'archive date'],
    [{ archivedOn: false }, 'archive date'],
    [{ pauses: {} }, 'list of at most'],
    [{ pauses: Array(1001).fill({ from: '2026-11-01', to: '2026-11-02' }) }, 'list of at most'],
    [{ pauses: [{ from: '2026-11-01' }] }, 'pause end'],
    [{ pauses: ['2026-11-01'] }, 'pause start'],
    [{ pauses: [{ from: '2026-11-05', to: '2026-11-01' }] }, 'ends before it starts'],
    [{ id: '' }, 'valid id'],
    [{ id: '__proto__' }, 'valid id'],
    [{ id: 'constructor' }, 'valid id'],
    [{ id: 'a b' }, 'valid id'],
  ])('%j', (patch, message) => expect(errorOf(withHabit(patch))).toContain(message));

  test('duplicate ids', () => {
    expect(errorOf(wrap({ ...sample, habits: [sample.habits[0], sample.habits[0]] }))).toContain('same id');
  });
});

describe('rejects malformed records', () => {
  test.each([
    [{ checkins: { h1: ['yesterday'] } }, 'not a valid date'],
    [{ checkins: { h1: '2026-11-20' } }, 'list of dates'],
    [{ checkins: [] }, 'not an object'],
    [{ sessions: [{ id: 's', habitId: null, day: '2026-11-20', minutes: 0 }] }, 'minutes'],
    [{ sessions: [{ id: 's', habitId: null, day: 'x', minutes: 5 }] }, 'not a valid date'],
    [{ sessions: {} }, 'must be a list'],
    [{ reflections: { '2026-11-20': { answers: ['a', 'b'] } } }, 'three text answers'],
    [{ reflections: { '2026-11-20': { answers: ['a', 'b', 3] } } }, 'three text answers'],
    [{ reflections: { someday: { answers: ['a', 'b', 'c'] } } }, 'not a valid date'],
    [{ settings: { theme: 'neon' } }, 'Theme'],
    [{ settings: { focusMinutes: 0 } }, 'Focus length'],
    [{ settings: { haptics: 'yes' } }, 'Haptics'],
    [{ settings: { reflectionReminder: '9pm' } }, 'time like'],
  ])('%j', (patch, message) => expect(errorOf(wrap({ ...sample, ...patch }))).toContain(message));
});

describe('normalises what it accepts', () => {
  test('sorts and de-duplicates days', () => {
    const d = validateData({ ...sample, checkins: { h1: ['2026-11-20', '2026-11-18', '2026-11-20'] } });
    expect(d.checkins.h1).toEqual(['2026-11-18', '2026-11-20']);
  });

  test('every habit gets its own lists; records of unknown habits are dropped', () => {
    const d = validateData({ ...sample, checkins: { ghost: ['2026-11-20'] }, freezes: undefined });
    expect(d.checkins).toEqual({ h1: [], h2: [], h3: [] });
    expect(d.freezes).toEqual({ h1: [], h2: [], h3: [] });
  });

  test('a focus session for an unknown habit keeps its minutes but loses the link', () => {
    const d = validateData({ ...sample, sessions: [{ id: 's', habitId: 'ghost', day: '2026-11-20', minutes: 25 }] });
    expect(d.sessions).toEqual([{ id: 's', habitId: null, day: '2026-11-20', minutes: 25 }]);
  });

  test('missing optional parts fall back to defaults', () => {
    const d = validateData({ habits: [] });
    expect(d).toEqual({ habits: [], checkins: {}, freezes: {}, sessions: [], reflections: {}, settings: DEFAULT_SETTINGS });
  });

  test('trims names and drops unknown fields', () => {
    const d = validateData({ habits: [{ ...sample.habits[0], name: '  Read  ', evil: '<script>' }] });
    expect(d.habits[0]).toEqual({ ...sample.habits[0], name: 'Read' });
  });

  test('an archive date survives a round trip; null or missing means active', () => {
    const archived = { ...sample, habits: [{ ...sample.habits[0], archivedOn: '2026-11-20' }] };
    expect(parseBackup(exportBackup(archived, new Date()))).toEqual({ ok: true, data: validateData(archived) });
    expect(validateData(archived).habits[0].archivedOn).toBe('2026-11-20');
    expect(validateData({ habits: [{ ...sample.habits[0], archivedOn: null }] }).habits[0]).toEqual(sample.habits[0]);
  });

  test('pauses are sorted and overlapping ones joined; null or missing means none', () => {
    const paused = { ...sample, habits: [{ ...sample.habits[0], pauses: [{ from: '2026-11-10', to: '2026-11-12' }, { from: '2026-11-01', to: '2026-11-03' }, { from: '2026-11-04', to: '2026-11-05' }, { from: '2026-11-11', to: '2026-11-11' }] }] };
    expect(validateData(paused).habits[0].pauses).toEqual([{ from: '2026-11-01', to: '2026-11-05' }, { from: '2026-11-10', to: '2026-11-12' }]);
    expect(parseBackup(exportBackup(validateData(paused), new Date()))).toEqual({ ok: true, data: validateData(paused) });
    expect(validateData({ habits: [{ ...sample.habits[0], pauses: null }] }).habits[0]).toEqual(sample.habits[0]);
  });

  test('does not pollute Object.prototype', () => {
    parseBackup('{"app":"streakline","version":1,"data":{"habits":[],"checkins":{"__proto__":{"polluted":true}},"__proto__":{"polluted":true}}}');
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

test('a backup saved with a byte-order mark (Windows editors add one) still imports', () => {
  const r = parseBackup('﻿' + exportBackup(sample, new Date('2026-11-21T10:00:00Z')));
  expect(r.ok && r.data).toEqual(sample);
});

test('unicode names and answers survive an export and import', () => {
  const data: Data = {
    ...sample,
    habits: [{ ...sample.habits[0], name: 'Oku 📚 çğışö' }],
    reflections: { '2026-11-20': { answers: ['日本語', '🙂', 'a\u0000b'] } },
  };
  const r = parseBackup(exportBackup(data, new Date()));
  expect(r.ok && r.data.habits[0].name).toBe('Oku 📚 çğışö');
  expect(r.ok && r.data.reflections['2026-11-20'].answers).toEqual(['日本語', '🙂', 'a\u0000b']);
});
