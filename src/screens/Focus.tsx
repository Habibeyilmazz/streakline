import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { tap } from '../haptics';
import { formatClock, remainingMs } from '../logic/timer';
import { useStore } from '../store';
import { fonts, useTheme } from '../theme';
import { Button, Chip, ChipRow, Page, Rule, Section, Txt } from '../ui';
import { formatMinutes } from './HabitDetail';

const LENGTHS = [15, 25, 45, 60];

function useNow(active: boolean): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

/** Tabular figures (the font has them) keep the clock from jittering as digits change. */
function Clock({ ms, color }: { ms: number; color: string }) {
  const text = formatClock(ms);
  const [min, sec] = text.split(':');
  return (
    <Text
      accessibilityRole="timer"
      accessibilityLabel={`${+min} minutes ${+sec} seconds left`}
      numberOfLines={1}
      adjustsFontSizeToFit
      style={{ textAlign: 'center', fontFamily: fonts.display, fontSize: 92, lineHeight: 100, fontVariant: ['tabular-nums'], color }}
    >
      {text}
    </Text>
  );
}

export function Focus() {
  const { data, timer, dispatch, today } = useStore();
  const t = useTheme();
  const [habitId, setHabitId] = useState<string | null>(null);
  const running = !!timer && timer.endsAt !== null;
  const now = useNow(running);
  const { focusMinutes, breakMinutes, haptics } = data.settings;

  const nameOf = (id: string | null) => data.habits.find((h) => h.id === id)?.name ?? null;
  const todaySessions = data.sessions.filter((s) => s.day === today);
  const todayMinutes = todaySessions.reduce((n, s) => n + s.minutes, 0);
  const act = (f: () => void) => () => {
    tap(haptics);
    f();
  };

  let body;
  if (timer) {
    const left = remainingMs(timer, now);
    const total = timer.minutes * 60_000;
    const habit = data.habits.find((h) => h.id === timer.habitId);
    const color = habit ? t.habit[habit.color] : t.ink;
    body = (
      <View style={{ gap: 20 }}>
        <View style={{ gap: 2 }}>
          <Txt muted>{timer.endsAt === null ? 'Paused' : timer.kind === 'break' ? 'Break' : 'Focusing'}</Txt>
          <Txt variant="display" accessibilityRole="header" numberOfLines={2}>{timer.kind === 'break' ? 'Rest your eyes' : habit?.name ?? 'Focus'}</Txt>
        </View>
        <Clock ms={left} color={t.ink} />
        <View style={{ height: 8, borderRadius: 4, backgroundColor: t.line, overflow: 'hidden' }} aria-hidden>
          <View style={{ height: 8, borderRadius: 4, backgroundColor: color, width: `${Math.min(100, (1 - left / total) * 100)}%` }} />
        </View>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {timer.endsAt === null ? (
            <Button label="Resume" style={{ flex: 1 }} onPress={act(() => dispatch({ type: 'timer/resume', now: Date.now() }))} />
          ) : (
            <Button label="Pause" style={{ flex: 1 }} onPress={act(() => dispatch({ type: 'timer/pause', now: Date.now() }))} />
          )}
          <Button label="Stop" kind="outline" style={{ flex: 1 }} onPress={act(() => dispatch({ type: 'timer/stop' }))} />
        </View>
        {timer.kind === 'focus' && <Txt variant="small" muted>Only a finished session is logged. Stopping early records nothing.</Txt>}
      </View>
    );
  } else {
    body = (
      <>
        <View style={{ gap: 2 }}>
          <Txt muted>Focus timer</Txt>
          <Txt variant="display" accessibilityRole="header">One thing, {focusMinutes} minutes</Txt>
        </View>

        {data.habits.length > 0 && (
          <Section title="For which habit?">
            <ChipRow label="Habit">
              <Chip label="No habit" selected={habitId === null} onPress={() => setHabitId(null)} />
              {data.habits.map((h) => (
                <Chip key={h.id} label={h.name} selected={habitId === h.id} color={t.habit[h.color]} onPress={() => setHabitId(h.id)} />
              ))}
            </ChipRow>
            {habitId !== null && data.settings.autoCheckIn && (
              <Txt variant="small" muted>Finishing the session checks {nameOf(habitId)} in for the day.</Txt>
            )}
          </Section>
        )}

        <Section title="How long?">
          <ChipRow label="Session length">
            {LENGTHS.map((m) => (
              <Chip key={m} label={`${m} min`} selected={focusMinutes === m} onPress={() => dispatch({ type: 'settings/set', patch: { focusMinutes: m } })} />
            ))}
          </ChipRow>
        </Section>

        <View style={{ gap: 12 }}>
          <Button label={`Start ${focusMinutes} minute focus`} onPress={act(() => dispatch({ type: 'timer/start', kind: 'focus', habitId, now: Date.now() }))} />
          <Button kind="outline" label={`Take a ${breakMinutes} minute break`} onPress={act(() => dispatch({ type: 'timer/start', kind: 'break', habitId: null, now: Date.now() }))} />
        </View>
      </>
    );
  }

  return (
    <Page>
      {body}
      {todaySessions.length === 0 ? (
        <Txt muted>No sessions yet today</Txt>
      ) : (
        <Section title={`Today: ${formatMinutes(todayMinutes)} in ${todaySessions.length} ${todaySessions.length === 1 ? 'session' : 'sessions'}`}>
          {todaySessions.map((s, i) => (
            <View key={s.id}>
              {i > 0 && <Rule />}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 }}>
                <Txt>{nameOf(s.habitId) ?? 'No habit'}</Txt>
                <Txt muted>{formatMinutes(s.minutes)}</Txt>
              </View>
            </View>
          ))}
        </Section>
      )}
    </Page>
  );
}
