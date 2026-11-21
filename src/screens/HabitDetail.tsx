import { useMemo } from 'react';
import { View } from 'react-native';

import { tap } from '../haptics';
import { addDays, dayMonthShort, eachDay, monthShort, WEEKDAYS_SHORT, weekday } from '../logic/dates';
import { yearGrid } from '../logic/stats';
import { FREEZES_PER_MONTH, dayStatus, describeSchedule, freezeBlocker, marksOf, streak } from '../logic/streaks';
import type { Habit } from '../logic/types';
import { useStore } from '../store';
import { fonts, useTheme } from '../theme';
import { Button, CheckMark, Heatmap, LegendItem, Page, Section, Tap, Txt, cellStyle, statusWord } from '../ui';

export const formatMinutes = (m: number) => (m < 60 ? `${m} min` : m % 60 === 0 ? `${m / 60} h` : `${Math.floor(m / 60)} h ${m % 60} min`);

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ flexBasis: '45%', flexGrow: 1 }} accessible accessibilityLabel={`${label}: ${value}`}>
      <Txt style={{ fontFamily: fonts.display, fontSize: 26, lineHeight: 31 }}>{value}</Txt>
      <Txt variant="small" muted>{label}</Txt>
    </View>
  );
}

export function HabitDetail({ habit, onEdit }: { habit: Habit; onEdit: () => void }) {
  const { data, dispatch, today } = useStore();
  const t = useTheme();
  const color = t.habit[habit.color];
  const marks = useMemo(() => marksOf(data, habit.id), [data, habit.id]);
  const s = streak(habit, marks, today);
  const weeks = useMemo(() => yearGrid(today), [today]);
  const unit = (n: number) => `${n} ${s.unit}${n === 1 ? '' : 's'}`;
  const focusMinutes = data.sessions.filter((x) => x.habitId === habit.id).reduce((n, x) => n + x.minutes, 0);
  const yesterday = addDays(today, -1);
  const usedThisMonth = [...marks.frozen].filter((d) => d.startsWith(today.slice(0, 7))).length;

  const freezeRow = (day: string, name: string) => {
    const frozen = marks.frozen.has(day);
    const blocker = frozen ? null : freezeBlocker(habit, day, today, marks);
    return (
      <View style={{ gap: 4 }}>
        <Button
          kind="outline"
          label={frozen ? `Unfreeze ${name}` : `Freeze ${name}`}
          disabled={!!blocker}
          onPress={() => {
            tap(data.settings.haptics);
            dispatch({ type: 'freeze/toggle', habitId: habit.id, day, today });
          }}
        />
        {blocker ? <Txt variant="small" muted>{blocker}</Txt> : null}
      </View>
    );
  };

  return (
    <Page>
      <View style={{ gap: 4 }}>
        <Txt variant="title" accessibilityRole="header">{habit.name}</Txt>
        <Txt muted>{describeSchedule(habit.schedule)}{habit.reminder ? `, reminder at ${habit.reminder}` : ''}</Txt>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 16, columnGap: 12 }}>
        <Stat value={unit(s.current)} label="Current streak" />
        <Stat value={unit(s.best)} label="Best streak" />
        <Stat value={String(marks.done.size)} label="Check-ins in total" />
        <Stat value={formatMinutes(focusMinutes)} label="Focus time" />
      </View>

      <Section title="Past year">
        <Heatmap
          weeks={weeks}
          label={`Past year of ${habit.name}: ${weeks.flat().filter((d) => marks.done.has(d)).length} days done`}
          cell={(day) => {
            const status = dayStatus(habit, day, today, marks);
            return status === 'none' || status === 'open' ? { backgroundColor: day > today ? 'transparent' : t.faint } : cellStyle(t, status, color);
          }}
        />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
          <LegendItem label="Done" style={cellStyle(t, 'done', color)} />
          <LegendItem label="Frozen" style={cellStyle(t, 'frozen', color)} />
          {habit.schedule.kind !== 'weekly' && <LegendItem label="Missed" style={cellStyle(t, 'missed', color)} />}
        </View>
      </Section>

      <Section title="Last 7 days">
        <Txt variant="small" muted>Forgot to check in? Tap a day to fix it.</Txt>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {eachDay(addDays(today, -6), today).map((day) => {
            const status = dayStatus(habit, day, today, marks);
            const done = status === 'done';
            return (
              <Tap
                key={day}
                onPress={() => {
                  tap(data.settings.haptics);
                  dispatch({ type: 'checkin/toggle', habitId: habit.id, day });
                }}
                accessibilityRole="checkbox"
                aria-checked={done}
                accessibilityLabel={`${WEEKDAYS_SHORT[weekday(day)]} ${dayMonthShort(day)}, ${statusWord(status)}`}
                style={{ flex: 1, alignItems: 'center', gap: 6, paddingVertical: 4 }}
              >
                <Txt variant="small" muted>{WEEKDAYS_SHORT[weekday(day)][0]}</Txt>
                <View style={[{ width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, cellStyle(t, status, color)]}>
                  {done && <CheckMark size={20} color={t.bg} />}
                </View>
                <Txt variant="small" muted>{+day.slice(8)}</Txt>
              </Tap>
            );
          })}
        </View>
      </Section>

      <Section title="Freeze a day">
        <Txt variant="small" muted>
          A freeze excuses a day you cannot do, so it does not break the streak. It is never counted as done. You get {FREEZES_PER_MONTH} per habit each month; {usedThisMonth} used in {monthShort(today)}.
        </Txt>
        {freezeRow(today, 'today')}
        {freezeRow(yesterday, 'yesterday')}
      </Section>

      <Button label="Edit habit" kind="outline" onPress={onEdit} />
    </Page>
  );
}
