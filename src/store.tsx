import AsyncStorage from '@react-native-async-storage/async-storage';
import { Dispatch, ReactNode, createContext, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { success } from './haptics';
import { validateData } from './logic/backup';
import { DayKey, dayKey } from './logic/dates';
import { Action, State, reducer } from './logic/reducer';
import { reminderPlan } from './logic/reminders';
import { isFinished, validateTimer } from './logic/timer';
import { EMPTY_DATA } from './logic/types';
import { syncNotifications } from './notifications';

// shortcut: all data is one JSON value (tens of KB per year of use); move to expo-sqlite if it nears AsyncStorage's ~2 MB per-value limit on Android.
const DATA_KEY = 'streakline/data/v1';
const TIMER_KEY = 'streakline/timer/v1';
const UNREADABLE_KEY = 'streakline/unreadable';

export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export type Loaded = { state: State; /** Stored data that failed validation, verbatim. */ unreadable: string | null };

export async function loadState(): Promise<Loaded> {
  const [rawData, rawTimer] = await Promise.all([AsyncStorage.getItem(DATA_KEY), AsyncStorage.getItem(TIMER_KEY)]);
  let data = EMPTY_DATA;
  let unreadable: string | null = null;
  if (rawData) {
    try {
      data = validateData(JSON.parse(rawData));
    } catch {
      // Never silently overwrite data we could not read: keep a copy, and let
      // the person decide (the app shows a recovery screen before continuing).
      unreadable = rawData;
      await AsyncStorage.setItem(UNREADABLE_KEY, rawData);
    }
  }
  let timer = null;
  try {
    timer = validateTimer(JSON.parse(rawTimer ?? 'null'));
  } catch {
    // a corrupt timer is simply dropped
  }
  return { state: { data, timer }, unreadable };
}

type Store = State & { dispatch: Dispatch<Action>; today: DayKey; saveFailed: boolean };
const StoreContext = createContext<Store | null>(null);

export function useStore(): Store {
  const s = useContext(StoreContext);
  if (!s) throw new Error('useStore outside StoreProvider');
  return s;
}

/** The current local day; re-checked when the app returns to the foreground and every 20s. */
function useToday(): DayKey {
  const [today, setToday] = useState(() => dayKey(new Date()));
  useEffect(() => {
    const check = () => setToday(dayKey(new Date()));
    const id = setInterval(check, 20_000);
    const sub = AppState.addEventListener('change', check);
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, []);
  return today;
}

export function StoreProvider({ initial, children }: { initial: State; children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial);
  const [saveFailed, setSaveFailed] = useState(false);
  const today = useToday();
  const { data, timer } = state;

  // Data and timer are written together: if a finished session were saved but
  // the cleared timer were not, the next launch would log the session twice.
  useEffect(() => {
    AsyncStorage.multiSet([
      [DATA_KEY, JSON.stringify(data)],
      [TIMER_KEY, JSON.stringify(timer)],
    ]).then(
      () => setSaveFailed(false),
      () => setSaveFailed(true),
    );
  }, [data, timer]);

  // Web only: another tab saved new data or a new timer. Adopt it instead of overwriting it with ours.
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
    const onStorage = (e: StorageEvent) => {
      if ((e.key !== DATA_KEY && e.key !== TIMER_KEY) || !e.newValue) return;
      try {
        const value = JSON.parse(e.newValue);
        dispatch(e.key === DATA_KEY ? { type: 'data/adopt', data: validateData(value) } : { type: 'timer/adopt', timer: validateTimer(value) });
      } catch {
        // unreadable data from another tab is ignored; this tab keeps its own
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Finish the timer when its end time passes, including after the app was suspended.
  const endsAt = timer?.endsAt ?? null;
  const haptics = data.settings.haptics;
  useEffect(() => {
    if (endsAt === null) return;
    const check = () => {
      if (timer && isFinished(timer, Date.now())) {
        dispatch({ type: 'timer/finish' });
        success(haptics);
      }
    };
    check();
    const id = setInterval(check, 500);
    return () => clearInterval(id);
    // Keyed on endsAt alone: it identifies the running timer.
  }, [endsAt]);

  const planKey = JSON.stringify(reminderPlan(data));
  const timerKind = timer?.kind;
  const sync = (ask: boolean) =>
    syncNotifications(
      JSON.parse(planKey),
      endsAt === null ? null : { at: endsAt, title: timerKind === 'break' ? 'Break over' : 'Focus session done', body: timerKind === 'break' ? 'Ready for the next one?' : 'Time is up. Nice work.' },
      ask,
    );
  const syncRef = useRef(sync);
  syncRef.current = sync;
  useEffect(() => syncRef.current(true), [planKey, endsAt, timerKind]);
  // Permission may have been granted in system settings while the app was away.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => s === 'active' && syncRef.current(false));
    return () => sub.remove();
  }, []);

  const value = useMemo(() => ({ data, timer, dispatch, today, saveFailed }), [data, timer, today, saveFailed]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
