// The timer stores the instant it ends, not a count of ticks, so it stays
// correct when the app is suspended in the background and resumed later.
export type Timer = {
  kind: 'focus' | 'break';
  habitId: string | null;
  /** Full planned length. */
  minutes: number;
  /** Epoch ms when it ends, or null while paused. */
  endsAt: number | null;
  /** Time left at the moment it was paused (or started). */
  remainingMs: number;
};

export function startTimer(kind: Timer['kind'], minutes: number, habitId: string | null, now: number): Timer {
  const ms = minutes * 60_000;
  return { kind, habitId, minutes, endsAt: now + ms, remainingMs: ms };
}

export const remainingMs = (t: Timer, now: number): number => (t.endsAt === null ? t.remainingMs : Math.max(0, t.endsAt - now));

export const pauseTimer = (t: Timer, now: number): Timer => ({ ...t, endsAt: null, remainingMs: remainingMs(t, now) });

export const resumeTimer = (t: Timer, now: number): Timer => (t.endsAt === null ? { ...t, endsAt: now + t.remainingMs } : t);

export const isFinished = (t: Timer, now: number): boolean => t.endsAt !== null && now >= t.endsAt;

/** 'MM:SS', rounding up so the clock shows 25:00 at the start and 00:00 only at the end. */
export function formatClock(ms: number): string {
  const total = Math.ceil(Math.max(0, ms) / 1000);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** Restores a timer saved by an earlier run of the app; anything malformed becomes null. */
export function validateTimer(v: unknown): Timer | null {
  if (typeof v !== 'object' || v === null) return null;
  const t = v as Record<string, unknown>;
  const num = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x) && x >= 0;
  if (t.kind !== 'focus' && t.kind !== 'break') return null;
  if (!num(t.minutes) || t.minutes < 1 || t.minutes > 180 || !num(t.remainingMs)) return null;
  if (t.endsAt !== null && !num(t.endsAt)) return null;
  if (t.habitId !== null && typeof t.habitId !== 'string') return null;
  return { kind: t.kind, habitId: t.habitId, minutes: t.minutes, endsAt: t.endsAt, remainingMs: Math.min(t.remainingMs, t.minutes * 60_000) };
}
