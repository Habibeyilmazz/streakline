import { DayKey, dayKey } from './dates';
import { freezeBlocker, marksOf } from './streaks';
import { Timer, isFinished, pauseTimer, resumeTimer, startTimer } from './timer';
import { Data, Habit, MAX_ANSWER_LENGTH, MAX_HABITS, MAX_SESSIONS, Settings } from './types';

export type State = { data: Data; timer: Timer | null };

// Time and ids arrive in the action, so the reducer stays a pure function.
export type Action =
  | { type: 'habit/save'; habit: Habit }
  | { type: 'habit/delete'; id: string }
  | { type: 'checkin/toggle'; habitId: string; day: DayKey }
  | { type: 'freeze/toggle'; habitId: string; day: DayKey; today: DayKey }
  | { type: 'reflection/save'; day: DayKey; answers: [string, string, string] }
  | { type: 'settings/set'; patch: Partial<Settings> }
  | { type: 'timer/start'; kind: Timer['kind']; habitId: string | null; now: number }
  | { type: 'timer/pause'; now: number }
  | { type: 'timer/resume'; now: number }
  | { type: 'timer/stop' }
  | { type: 'timer/finish'; sessionId: string }
  | { type: 'data/replace'; data: Data };

const without = <T>(rec: Record<string, T>, key: string) => Object.fromEntries(Object.entries(rec).filter(([k]) => k !== key));
const toggled = (list: readonly DayKey[] = [], day: DayKey) => (list.includes(day) ? list.filter((d) => d !== day) : [...list, day].sort());
const added = (list: readonly DayKey[] = [], day: DayKey) => (list.includes(day) ? [...list] : [...list, day].sort());

export function reducer(state: State, action: Action): State {
  const { data, timer } = state;
  const withData = (patch: Partial<Data>): State => ({ ...state, data: { ...data, ...patch } });
  const exists = (id: string) => data.habits.some((h) => h.id === id);

  switch (action.type) {
    case 'habit/save': {
      const h = action.habit;
      if (!exists(h.id) && data.habits.length >= MAX_HABITS) return state;
      return withData({
        habits: exists(h.id) ? data.habits.map((x) => (x.id === h.id ? h : x)) : [...data.habits, h],
        checkins: { ...data.checkins, [h.id]: data.checkins[h.id] ?? [] },
        freezes: { ...data.freezes, [h.id]: data.freezes[h.id] ?? [] },
      });
    }

    case 'habit/delete': {
      const { id } = action;
      return {
        timer: timer && timer.habitId === id ? { ...timer, habitId: null } : timer,
        data: {
          ...data,
          habits: data.habits.filter((h) => h.id !== id),
          checkins: without(data.checkins, id),
          freezes: without(data.freezes, id),
          // Focus time already spent stays in the totals, just no longer tied to a habit.
          sessions: data.sessions.map((s) => (s.habitId === id ? { ...s, habitId: null } : s)),
        },
      };
    }

    case 'checkin/toggle': {
      const { habitId, day } = action;
      if (!exists(habitId)) return state;
      return withData({
        checkins: { ...data.checkins, [habitId]: toggled(data.checkins[habitId], day) },
        // A day is done or frozen, never both.
        freezes: { ...data.freezes, [habitId]: (data.freezes[habitId] ?? []).filter((d) => d !== day) },
      });
    }

    case 'freeze/toggle': {
      const { habitId, day, today } = action;
      const habit = data.habits.find((h) => h.id === habitId);
      if (!habit) return state;
      const current = data.freezes[habitId] ?? [];
      if (!current.includes(day) && freezeBlocker(habit, day, today, marksOf(data, habitId))) return state;
      return withData({ freezes: { ...data.freezes, [habitId]: toggled(current, day) } });
    }

    case 'reflection/save': {
      const answers = action.answers.map((a) => a.trim().slice(0, MAX_ANSWER_LENGTH)) as [string, string, string];
      const rest = without(data.reflections, action.day);
      // Saving three empty answers removes the day's reflection.
      return withData({ reflections: answers.some(Boolean) ? { ...rest, [action.day]: { answers } } : rest });
    }

    case 'settings/set':
      return withData({ settings: { ...data.settings, ...action.patch } });

    case 'timer/start': {
      const habitId = action.habitId !== null && exists(action.habitId) ? action.habitId : null;
      const minutes = action.kind === 'focus' ? data.settings.focusMinutes : data.settings.breakMinutes;
      return { ...state, timer: startTimer(action.kind, minutes, action.kind === 'focus' ? habitId : null, action.now) };
    }
    case 'timer/pause':
      // A timer that has already run out must finish, not freeze at 00:00.
      return timer && !isFinished(timer, action.now) ? { ...state, timer: pauseTimer(timer, action.now) } : state;
    case 'timer/resume':
      return timer ? { ...state, timer: resumeTimer(timer, action.now) } : state;
    case 'timer/stop':
      return { ...state, timer: null };

    case 'timer/finish': {
      if (!timer || timer.endsAt === null) return state;
      if (timer.kind === 'break') return { ...state, timer: null };
      // The session belongs to the day it ended on, even if the app only noticed later.
      const day = dayKey(new Date(timer.endsAt));
      const { habitId, minutes } = timer;
      const checkIn = habitId !== null && data.settings.autoCheckIn && exists(habitId);
      return {
        timer: null,
        data: {
          ...data,
          sessions: [...data.sessions, { id: action.sessionId, habitId, day, minutes }].slice(-MAX_SESSIONS),
          ...(checkIn && {
            checkins: { ...data.checkins, [habitId]: added(data.checkins[habitId], day) },
            freezes: { ...data.freezes, [habitId]: (data.freezes[habitId] ?? []).filter((d) => d !== day) },
          }),
        },
      };
    }

    case 'data/replace':
      return { data: action.data, timer: null };
  }
}
