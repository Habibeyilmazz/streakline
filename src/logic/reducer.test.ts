import { Action, State, reducer } from './reducer';
import { EMPTY_DATA, Habit } from './types';

const read: Habit = { id: 'read', name: 'Read', color: 0, schedule: { kind: 'daily' }, createdOn: '2026-11-01', reminder: null };
const run = (actions: Action[], from: State = { data: EMPTY_DATA, timer: null }) => actions.reduce(reducer, from);
const base = run([{ type: 'habit/save', habit: read }]);
// Local noon, so the local date is the same in every zone the tests run in.
const NOON = new Date(2026, 10, 21, 12).getTime();

test('saving a new habit adds it with empty records; saving again edits it in place', () => {
  expect(base.data.habits).toEqual([read]);
  expect(base.data.checkins).toEqual({ read: [] });
  const s = run([{ type: 'checkin/toggle', habitId: 'read', day: '2026-11-21' }, { type: 'habit/save', habit: { ...read, name: 'Read more' } }], base);
  expect(s.data.habits).toEqual([{ ...read, name: 'Read more' }]);
  expect(s.data.checkins.read).toEqual(['2026-11-21']); // history survives an edit
});

test('check-in toggles on and off and stays sorted', () => {
  const s = run([
    { type: 'checkin/toggle', habitId: 'read', day: '2026-11-21' },
    { type: 'checkin/toggle', habitId: 'read', day: '2026-11-19' },
    { type: 'checkin/toggle', habitId: 'read', day: '2026-11-20' },
    { type: 'checkin/toggle', habitId: 'read', day: '2026-11-19' },
  ], base);
  expect(s.data.checkins.read).toEqual(['2026-11-20', '2026-11-21']);
});

test('checking in an unknown habit does nothing', () => {
  expect(run([{ type: 'checkin/toggle', habitId: 'ghost', day: '2026-11-21' }], base)).toBe(base);
});

test('freeze obeys the rules; checking in replaces a freeze', () => {
  const today = '2026-11-21';
  const frozen = run([{ type: 'freeze/toggle', habitId: 'read', day: '2026-11-20', today }], base);
  expect(frozen.data.freezes.read).toEqual(['2026-11-20']);
  // Too old: refused.
  expect(run([{ type: 'freeze/toggle', habitId: 'read', day: '2026-11-10', today }], frozen)).toBe(frozen);
  // Checking in the frozen day converts it.
  const done = run([{ type: 'checkin/toggle', habitId: 'read', day: '2026-11-20' }], frozen);
  expect(done.data.freezes.read).toEqual([]);
  expect(done.data.checkins.read).toEqual(['2026-11-20']);
  // An existing freeze can always be removed, even an old one.
  const later = run([{ type: 'freeze/toggle', habitId: 'read', day: '2026-11-20', today: '2026-12-25' }], frozen);
  expect(later.data.freezes.read).toEqual([]);
});

test('deleting a habit removes its records but keeps its focus minutes', () => {
  const s = run([
    { type: 'checkin/toggle', habitId: 'read', day: '2026-11-21' },
    { type: 'timer/start', kind: 'focus', habitId: 'read', now: NOON },
    { type: 'timer/finish', sessionId: 's1' },
    { type: 'timer/start', kind: 'focus', habitId: 'read', now: NOON },
    { type: 'habit/delete', id: 'read' },
  ], base);
  expect(s.data.habits).toEqual([]);
  expect(s.data.checkins).toEqual({});
  expect(s.data.freezes).toEqual({});
  expect(s.data.sessions).toEqual([{ id: 's1', habitId: null, day: '2026-11-21', minutes: 25 }]);
  expect(s.timer?.habitId).toBeNull();
});

describe('focus timer', () => {
  test('finishing a focus session logs it and checks the habit in', () => {
    const s = run([{ type: 'timer/start', kind: 'focus', habitId: 'read', now: NOON }, { type: 'timer/finish', sessionId: 's1' }], base);
    expect(s.timer).toBeNull();
    expect(s.data.sessions).toEqual([{ id: 's1', habitId: 'read', day: '2026-11-21', minutes: 25 }]);
    expect(s.data.checkins.read).toEqual(['2026-11-21']);
  });

  test('a second session the same day does not duplicate the check-in', () => {
    const one = [{ type: 'timer/start', kind: 'focus', habitId: 'read', now: NOON }, { type: 'timer/finish', sessionId: 's1' }] as Action[];
    const s = run([...one, { type: 'timer/start', kind: 'focus', habitId: 'read', now: NOON + 3_600_000 }, { type: 'timer/finish', sessionId: 's2' }], base);
    expect(s.data.sessions).toHaveLength(2);
    expect(s.data.checkins.read).toEqual(['2026-11-21']);
  });

  test('the session belongs to the day it ended, not the day the app noticed', () => {
    // Starts 23:50, ends 00:15 the next day.
    const start = new Date(2026, 10, 21, 23, 50).getTime();
    const s = run([{ type: 'timer/start', kind: 'focus', habitId: 'read', now: start }, { type: 'timer/finish', sessionId: 's1' }], base);
    expect(s.data.sessions[0].day).toBe('2026-11-22');
    expect(s.data.checkins.read).toEqual(['2026-11-22']);
  });

  test('auto check-in can be switched off', () => {
    const s = run([
      { type: 'settings/set', patch: { autoCheckIn: false, focusMinutes: 50 } },
      { type: 'timer/start', kind: 'focus', habitId: 'read', now: NOON },
      { type: 'timer/finish', sessionId: 's1' },
    ], base);
    expect(s.data.sessions[0].minutes).toBe(50);
    expect(s.data.checkins.read).toEqual([]);
  });

  test('a break logs nothing; a paused timer cannot finish; stop discards', () => {
    const brk = run([{ type: 'timer/start', kind: 'break', habitId: 'read', now: NOON }], base);
    expect(brk.timer).toMatchObject({ kind: 'break', habitId: null, minutes: 5 });
    expect(run([{ type: 'timer/finish', sessionId: 's' }], brk).data.sessions).toEqual([]);

    const paused = run([{ type: 'timer/start', kind: 'focus', habitId: null, now: NOON }, { type: 'timer/pause', now: NOON + 1000 }], base);
    expect(run([{ type: 'timer/finish', sessionId: 's' }], paused)).toBe(paused);
    expect(run([{ type: 'timer/stop' }], paused)).toMatchObject({ timer: null, data: { sessions: [] } });
  });

  test('a focus session with no habit, or a deleted one, is still logged', () => {
    const s = run([{ type: 'timer/start', kind: 'focus', habitId: 'ghost', now: NOON }, { type: 'timer/finish', sessionId: 's1' }], base);
    expect(s.data.sessions).toEqual([{ id: 's1', habitId: null, day: '2026-11-21', minutes: 25 }]);
  });
});

test('reflections are trimmed; saving three blanks removes the day', () => {
  const saved = run([{ type: 'reflection/save', day: '2026-11-21', answers: ['  good  ', '', 'sleep'] }], base);
  expect(saved.data.reflections).toEqual({ '2026-11-21': { answers: ['good', '', 'sleep'] } });
  const cleared = run([{ type: 'reflection/save', day: '2026-11-21', answers: [' ', '', ''] }], saved);
  expect(cleared.data.reflections).toEqual({});
});

test('replacing all data also clears the timer', () => {
  const s = run([{ type: 'timer/start', kind: 'focus', habitId: 'read', now: NOON }, { type: 'data/replace', data: EMPTY_DATA }], base);
  expect(s).toEqual({ data: EMPTY_DATA, timer: null });
});

test('the reducer never mutates its input', () => {
  const frozen = JSON.stringify(base);
  run([
    { type: 'checkin/toggle', habitId: 'read', day: '2026-11-21' },
    { type: 'freeze/toggle', habitId: 'read', day: '2026-11-20', today: '2026-11-21' },
    { type: 'reflection/save', day: '2026-11-21', answers: ['a', 'b', 'c'] },
    { type: 'habit/delete', id: 'read' },
  ], base);
  expect(JSON.stringify(base)).toBe(frozen);
});
