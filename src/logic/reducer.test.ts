import { validateData } from './backup';
import { Action, State, reducer } from './reducer';
import { validateTimer } from './timer';
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

test('the 201st habit is refused, so the app never saves more than it can load', () => {
  const full = run(Array.from({ length: 205 }, (_, i): Action => ({ type: 'habit/save', habit: { ...read, id: `h${i}` } })));
  expect(full.data.habits).toHaveLength(200);
  expect(() => validateData(JSON.parse(JSON.stringify(full.data)))).not.toThrow();
  // Editing an existing habit still works at the limit.
  expect(run([{ type: 'habit/save', habit: { ...read, id: 'h0', name: 'Renamed' } }], full).data.habits[0].name).toBe('Renamed');
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
    { type: 'timer/finish' },
    { type: 'timer/start', kind: 'focus', habitId: 'read', now: NOON },
    { type: 'habit/delete', id: 'read' },
  ], base);
  expect(s.data.habits).toEqual([]);
  expect(s.data.checkins).toEqual({});
  expect(s.data.freezes).toEqual({});
  expect(s.data.sessions).toEqual([{ id: expect.any(String), habitId: null, day: '2026-11-21', minutes: 25 }]);
  expect(s.timer?.habitId).toBeNull();
});

test('moving a habit swaps it with its active neighbour, skipping archived habits', () => {
  const s = run(['a', 'b', 'c', 'd'].map((id): Action => ({ type: 'habit/save', habit: { ...read, id } })));
  const order = (st: State) => st.data.habits.map((h) => h.id).join('');
  expect(order(run([{ type: 'habit/move', id: 'c', by: -1 }], s))).toBe('acbd');
  expect(order(run([{ type: 'habit/move', id: 'a', by: 1 }], s))).toBe('bacd');
  // At either end, or for an unknown habit, nothing changes.
  expect(run([{ type: 'habit/move', id: 'a', by: -1 }], s)).toBe(s);
  expect(run([{ type: 'habit/move', id: 'd', by: 1 }], s)).toBe(s);
  expect(run([{ type: 'habit/move', id: 'ghost', by: 1 }], s)).toBe(s);
  // An archived habit keeps its place and is jumped over; it cannot be moved itself.
  const withArchived = run([{ type: 'habit/archive', id: 'b', day: '2026-11-21' }], s);
  expect(order(run([{ type: 'habit/move', id: 'a', by: 1 }], withArchived))).toBe('cbad');
  expect(run([{ type: 'habit/move', id: 'b', by: 1 }], withArchived)).toBe(withArchived);
});

describe('focus timer', () => {
  test('finishing a focus session logs it and checks the habit in', () => {
    const s = run([{ type: 'timer/start', kind: 'focus', habitId: 'read', now: NOON }, { type: 'timer/finish' }], base);
    expect(s.timer).toBeNull();
    expect(s.data.sessions).toEqual([{ id: expect.any(String), habitId: 'read', day: '2026-11-21', minutes: 25 }]);
    expect(s.data.checkins.read).toEqual(['2026-11-21']);
  });

  test('a second session the same day does not duplicate the check-in', () => {
    const one = [{ type: 'timer/start', kind: 'focus', habitId: 'read', now: NOON }, { type: 'timer/finish' }] as Action[];
    const s = run([...one, { type: 'timer/start', kind: 'focus', habitId: 'read', now: NOON + 3_600_000 }, { type: 'timer/finish' }], base);
    expect(s.data.sessions).toHaveLength(2);
    expect(s.data.checkins.read).toEqual(['2026-11-21']);
  });

  test('the session belongs to the day it ended, not the day the app noticed', () => {
    // Starts 23:50, ends 00:15 the next day.
    const start = new Date(2026, 10, 21, 23, 50).getTime();
    const s = run([{ type: 'timer/start', kind: 'focus', habitId: 'read', now: start }, { type: 'timer/finish' }], base);
    expect(s.data.sessions[0].day).toBe('2026-11-22');
    expect(s.data.checkins.read).toEqual(['2026-11-22']);
  });

  test('auto check-in can be switched off', () => {
    const s = run([
      { type: 'settings/set', patch: { autoCheckIn: false, focusMinutes: 50 } },
      { type: 'timer/start', kind: 'focus', habitId: 'read', now: NOON },
      { type: 'timer/finish' },
    ], base);
    expect(s.data.sessions[0].minutes).toBe(50);
    expect(s.data.checkins.read).toEqual([]);
  });

  test('a break logs nothing; a paused timer cannot finish; stop discards', () => {
    const brk = run([{ type: 'timer/start', kind: 'break', habitId: 'read', now: NOON }], base);
    expect(brk.timer).toMatchObject({ kind: 'break', habitId: null, minutes: 5 });
    expect(run([{ type: 'timer/finish' }], brk).data.sessions).toEqual([]);

    const paused = run([{ type: 'timer/start', kind: 'focus', habitId: null, now: NOON }, { type: 'timer/pause', now: NOON + 1000 }], base);
    expect(run([{ type: 'timer/finish' }], paused)).toBe(paused);
    expect(run([{ type: 'timer/stop' }], paused)).toMatchObject({ timer: null, data: { sessions: [] } });
  });

  test('a timer that already ran out cannot be paused into limbo', () => {
    const started = run([{ type: 'timer/start', kind: 'focus', habitId: 'read', now: NOON }], base);
    const late = run([{ type: 'timer/pause', now: NOON + 25 * 60_000 }], started);
    expect(late).toBe(started);
    expect(run([{ type: 'timer/finish' }], late).data.sessions).toHaveLength(1);
  });

  test('a focus session with no habit, or a deleted one, is still logged', () => {
    const s = run([{ type: 'timer/start', kind: 'focus', habitId: 'ghost', now: NOON }, { type: 'timer/finish' }], base);
    expect(s.data.sessions).toEqual([{ id: expect.any(String), habitId: null, day: '2026-11-21', minutes: 25 }]);
  });
});

test('a tampered stored timer cannot finish into data the app refuses to load', () => {
  // The timer is read back from device storage, a trust boundary like an imported file.
  const saved = { kind: 'focus', habitId: 'read', minutes: 25, endsAt: NOON, remainingMs: 1_500_000 };
  for (const tampered of [{ ...saved, minutes: 2.5 }, { ...saved, endsAt: 1e20 }, { ...saved, endsAt: Date.UTC(2300, 0, 1) }, { ...saved, endsAt: 0 }]) {
    const timer = validateTimer(tampered);
    if (timer === null) continue; // refusing it outright is fine
    const s = run([{ type: 'timer/finish' }], { ...base, timer });
    expect(() => validateData(JSON.parse(JSON.stringify(s.data)))).not.toThrow();
  }
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

test('adopting another tab\'s data keeps the running timer; adopting its timer keeps the data', () => {
  const running = run([{ type: 'timer/start', kind: 'focus', habitId: 'read', now: NOON }], base);
  const withData = run([{ type: 'data/adopt', data: { ...EMPTY_DATA, habits: [] } }], running);
  expect(withData.timer).toEqual(running.timer);
  expect(withData.data.habits).toEqual([]);
  const stopped = run([{ type: 'timer/adopt', timer: null }], running);
  expect(stopped).toEqual({ data: base.data, timer: null });
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

describe('archive and restore', () => {
  const archived = run([{ type: 'checkin/toggle', habitId: 'read', day: '2026-11-18' }, { type: 'habit/archive', id: 'read', day: '2026-11-20' }], base);

  test('archiving keeps every record and stores the date; restoring removes only the date', () => {
    expect(archived.data.habits[0]).toEqual({ ...read, archivedOn: '2026-11-20' });
    expect(archived.data.checkins.read).toEqual(['2026-11-18']);
    const restored = run([{ type: 'habit/restore', id: 'read' }], archived);
    expect(restored.data.habits[0]).toEqual(read);
    expect(restored.data.checkins.read).toEqual(['2026-11-18']);
    expect(() => validateData(JSON.parse(JSON.stringify(archived.data)))).not.toThrow();
  });

  test('archiving twice moves the date; unknown ids do nothing', () => {
    expect(run([{ type: 'habit/archive', id: 'read', day: '2026-11-25' }], archived).data.habits[0].archivedOn).toBe('2026-11-25');
    expect(run([{ type: 'habit/archive', id: 'ghost', day: '2026-11-25' }], archived)).toBe(archived);
    expect(run([{ type: 'habit/restore', id: 'ghost' }], archived)).toBe(archived);
  });

  test('no check-in can be added on or after the archive date, but earlier days can still change', () => {
    expect(run([{ type: 'checkin/toggle', habitId: 'read', day: '2026-11-21' }], archived)).toBe(archived);
    expect(run([{ type: 'checkin/toggle', habitId: 'read', day: '2026-11-19' }], archived).data.checkins.read).toEqual(['2026-11-18', '2026-11-19']);
  });

  test('two web tabs finishing the same timer log one session', () => {
    const running = run([{ type: 'timer/start', kind: 'focus', habitId: 'read', now: NOON }], base);
    const tabA = run([{ type: 'timer/finish' }], running);
    // Tab B adopts A's saved data before it hears that the timer stopped, then finishes too.
    const tabB = run([{ type: 'data/adopt', data: tabA.data }, { type: 'timer/finish' }], running);
    expect(tabB).toEqual(tabA);
    expect(tabB.data.sessions).toHaveLength(1);
    // Finishing at the same instant without hearing from each other gives identical data.
    expect(run([{ type: 'timer/finish' }], running)).toEqual(tabA);
  });

  test('a focus session that ends after its habit was archived logs minutes but no check-in', () => {
    const s = run([
      { type: 'timer/start', kind: 'focus', habitId: 'read', now: NOON },
      { type: 'habit/archive', id: 'read', day: '2026-11-21' },
      { type: 'timer/finish' },
    ], base);
    expect(s.data.sessions).toHaveLength(1);
    expect(s.data.checkins.read).toEqual([]);
  });
});
