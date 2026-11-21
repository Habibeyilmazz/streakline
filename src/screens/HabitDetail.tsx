import { useMemo } from 'react';
import { View } from 'react-native';

import { tap } from '../haptics';
import { addDays, dayMonthShort, eachDay, monthShort, WEEKDAYS_SHORT, weekday } from '../logic/dates';
import { yearGrid } from '../logic/stats';
import { FREEZES_PER_MONTH, archivedBy, dayStatus, describeSchedule, freezeBlocker, marksOf, pausedOn, streak } from '../logic/streaks';
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
  const archived = archivedBy(habit, today);
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
        <Txt variant="title" accessibilityRole="header" aria-level={2}>{habit.name}</Txt>
        <Txt muted>{describeSchedule(habit.schedule)}{habit.reminder ? `, reminder at ${habit.reminder}` : ''}</Txt>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 16, columnGap: 12 }}>
        <Stat value={unit(s.current)} label={archived ? 'Streak when archived' : 'Current streak'} />
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

      {archived ? (
        <Section title="Archived">
          <Txt variant="small" muted>
            Since {dayMonthShort(habit.archivedOn!)} this habit is not on Today, in reminders, the focus timer or the weekly review. Its history stays. Restore it when you want to track it again: the days in between are excused, like a freeze, so its streak carries on.
          </Txt>
          <Button label="Restore habit" onPress={() => dispatch({ type: 'habit/restore', id: habit.id, day: today })} />
        </Section>
      ) : (
        <>
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
                    accessibilityLabel={`${WEEKDAYS_SHORT[weekday(day)]} ${dayMonthShort(day)}, ${!done && pausedOn(habit, day) ? 'paused' : statusWord(status)}`}
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
        </>
      )}

      <Button label="Edit habit" kind="outline" onPress={onEdit} />
      {!archived && (
        <View style={{ gap: 4 }}>
          <Button label="Archive habit" kind="outline" onPress={() => dispatch({ type: 'habit/archive', id: habit.id, day: today })} />
          <Txt variant="small" muted>Stop tracking it from today and keep its history. Away or ill for a while? Archive it now and restore it when you are back: the days in between are excused and its streak carries on.</Txt>
        </View>
      )}
    </Page>
  );
}
