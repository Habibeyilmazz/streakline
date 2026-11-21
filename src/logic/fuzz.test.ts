import { validateData } from './backup';
import { addDays, weekStart } from './dates';
import { Action, State, reducer } from './reducer';
import { dayLevels, weekReview, yearGrid } from './stats';
import { marksOf, streak } from './streaks';
import { EMPTY_DATA, Habit, Schedule } from './types';

// Seeded, so a failure is reproducible: the message names the seed and step.
const rng = (seed: number) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const TODAY = '2026-03-29';

function randomAction(r: () => number, step: number): Action {
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)];
  const id = pick(['a', 'b', 'c']);
  const day = addDays(TODAY, -Math.floor(r() * 13) + 1); // includes a day after today
  const schedules: Schedule[] = [{ kind: 'daily' }, { kind: 'weekdays', days: [1, 3, 5] }, { kind: 'weekly', times: 3 }];
  switch (Math.floor(r() * 14)) {
    case 0: {
      const h: Habit = { id, name: 'H' + id, color: 0, schedule: pick(schedules), createdOn: day, reminder: null };
      return { type: 'habit/save', habit: h };
    }
    case 1: return { type: 'habit/delete', id };
    case 2: return pick([true, false]) ? { type: 'habit/archive', id, day } : { type: 'habit/archive', id, day, resumeOn: addDays(day, Math.floor(r() * 5) - 1) };
    case 3: return { type: 'habit/restore', id, day };
    case 4: case 5: return { type: 'checkin/toggle', habitId: id, day };
    case 6: return { type: 'freeze/toggle', habitId: id, day, today: TODAY };
    case 7: return { type: 'reflection/save', day, answers: [pick(['', 'x', ' y ']), '', 'z'] };
    case 8: return { type: 'timer/start', kind: 'focus', habitId: pick([id, null]), now: Date.UTC(2026, 2, 29, 10) + step };
    case 9: return { type: 'timer/finish' };
    case 10: return { type: 'timer/pause', now: Date.UTC(2026, 2, 29, 10) + step };
    case 11: return { type: 'habit/move', id, by: pick([-1, 1] as const) };
    case 12: return { type: 'habit/resumeDue', today: day };
    default: return { type: 'timer/resume', now: Date.UTC(2026, 2, 29, 10) + step };
  }
}

test('random action sequences never leave data the validator would refuse, and the stats never break', () => {
  for (let seed = 1; seed <= 60; seed++) {
    const r = rng(seed);
    let s: State = { data: EMPTY_DATA, timer: null };
    for (let step = 0; step < 60; step++) {
      const a = randomAction(r, step);
      s = reducer(s, a);
      const where = `seed ${seed} step ${step} ${JSON.stringify(a)}`;
      let again;
      try {
        again = validateData(JSON.parse(JSON.stringify(s.data)));
      } catch (e) {
        throw new Error(`${where}: ${(e as Error).message}`);
      }
      expect({ where, data: again }).toEqual({ where, data: s.data });
      for (const h of s.data.habits) {
        const st = streak(h, marksOf(s.data, h.id), TODAY);
        expect({ where, ok: Number.isInteger(st.current) && st.current >= 0 && st.best >= st.current }).toEqual({ where, ok: true });
      }
      if (step % 20 === 19) {
        weekReview(s.data, weekStart(TODAY), TODAY);
        dayLevels(s.data, yearGrid(TODAY).flat(), TODAY);
      }
    }
  }
});
