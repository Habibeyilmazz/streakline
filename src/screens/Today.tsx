import { View } from 'react-native';

import { tap } from '../haptics';
import { addDays, dayMonthLong, dayMonthShort, eachDay, weekdayLong } from '../logic/dates';
import { weekCount } from '../logic/stats';
import { archivedBy, dayStatus, describeSchedule, marksOf, streak, todayState } from '../logic/streaks';
import type { Habit } from '../logic/types';
import { useStore } from '../store';
import { fonts, useTheme } from '../theme';
import { Button, CheckMark, Page, Rule, StreakLine, StreakLineLegend, Tap, Txt } from '../ui';

const LINE_DAYS = 14;

export function Today({ onOpen, onAdd }: { onOpen: (id: string) => void; onAdd: () => void }) {
  const { data, dispatch, today } = useStore();
  const t = useTheme();
  const lineDays = eachDay(addDays(today, 1 - LINE_DAYS), today);

  const archived = data.habits.filter((h) => archivedBy(h, today));
  const rows = data.habits.filter((h) => !archivedBy(h, today)).map((habit) => {
    const marks = marksOf(data, habit.id);
    return { habit, statuses: lineDays.map((d) => dayStatus(habit, d, today, marks)), streak: streak(habit, marks, today), state: todayState(habit, today, marks) };
  });
  const dueRows = rows.filter((r) => r.state !== 'off');
  const restRows = rows.filter((r) => r.state === 'off');
  const doneCount = dueRows.filter((r) => r.state === 'done').length;

  const toggle = (habit: Habit) => {
    tap(data.settings.haptics);
    dispatch({ type: 'checkin/toggle', habitId: habit.id, day: today });
  };

  const renderRow = ({ habit, statuses, streak: s }: (typeof rows)[number]) => {
    const color = t.habit[habit.color];
    const status = statuses[LINE_DAYS - 1];
    const done = status === 'done';
    const detail =
      habit.schedule.kind === 'weekly'
        ? `${weekCount(data.checkins[habit.id], today)} of ${habit.schedule.times} this week`
        : status === 'frozen'
          ? 'Frozen today'
          : describeSchedule(habit.schedule);
    return (
      <View key={habit.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 }}>
        <Tap
          onPress={() => toggle(habit)}
          accessibilityRole="checkbox"
          aria-checked={done}
          accessibilityLabel={`${habit.name}, done today`}
          style={{ width: 48, height: 48, borderRadius: 16, borderWidth: 2, borderColor: color, backgroundColor: done ? color : 'transparent', alignItems: 'center', justifyContent: 'center' }}
        >
          {done && <CheckMark size={26} color={t.bg} />}
        </Tap>
        <Tap onPress={() => onOpen(habit.id)} accessibilityLabel={`${habit.name}, ${detail}, ${s.current} ${s.unit} streak. Open details`} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Txt variant="heading" numberOfLines={2}>{habit.name}</Txt>
            <Txt variant="small" muted numberOfLines={1} style={{ marginBottom: 6 }}>{detail}</Txt>
            <StreakLine statuses={statuses} color={color} />
          </View>
          <View style={{ alignItems: 'flex-end', minWidth: 46 }}>
            <Txt style={{ fontFamily: fonts.display, fontSize: 26, lineHeight: 30 }} color={s.current > 0 ? t.ink : t.muted}>{s.current}</Txt>
            <Txt variant="small" muted>{s.unit === 'day' ? (s.current === 1 ? 'day' : 'days') : s.current === 1 ? 'week' : 'weeks'}</Txt>
          </View>
        </Tap>
      </View>
    );
  };

  return (
    <Page>
      <View style={{ gap: 2 }}>
        <Txt muted>{weekdayLong(today)}</Txt>
        <Txt variant="display" accessibilityRole="header">{dayMonthLong(today)}</Txt>
      </View>

      {rows.length === 0 ? (
        <View style={{ gap: 16 }}>
          <Txt variant="title">Nothing to track yet.</Txt>
          <Txt muted>Add one thing you want to do regularly. You check it in with one tap, and the line shows how long you have kept it going.</Txt>
          <Button label="Add a habit" onPress={onAdd} />
        </View>
      ) : (
        <>
          {dueRows.length > 0 && (
            <View>
              <View style={{ gap: 8, marginBottom: 6 }}>
                <Txt variant="heading" accessibilityRole="header" aria-level={2}>
                  {doneCount === dueRows.length ? `All ${dueRows.length} done today` : `${doneCount} of ${dueRows.length} done today`}
                </Txt>
                <View style={{ flexDirection: 'row', gap: 4 }} aria-hidden>
                  {dueRows.map((r) => (
                    <View key={r.habit.id} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: r.state === 'done' ? t.habit[r.habit.color] : t.line }} />
                  ))}
                </View>
              </View>
              {dueRows.map((r, i) => (
                <View key={r.habit.id}>
                  {i > 0 && <Rule />}
                  {renderRow(r)}
                </View>
              ))}
            </View>
          )}

          {restRows.length > 0 && (
            <View>
              <Txt variant="heading" muted accessibilityRole="header" aria-level={2}>Not due today</Txt>
              {restRows.map((r, i) => (
                <View key={r.habit.id}>
                  {i > 0 && <Rule />}
                  {renderRow(r)}
                </View>
              ))}
            </View>
          )}

          <Button kind="outline" label="Add a habit" onPress={onAdd} />

          <View style={{ gap: 8 }}>
            <Txt variant="small" muted>Each line is the last {LINE_DAYS} days. A ring at the end means today is still open.</Txt>
            <StreakLineLegend />
          </View>
        </>
      )}

      {archived.length > 0 && (
        <View>
          <Txt variant="heading" muted accessibilityRole="header" aria-level={2}>Archived</Txt>
          {archived.map((habit, i) => (
            <View key={habit.id}>
              {i > 0 && <Rule />}
              <Tap
                onPress={() => onOpen(habit.id)}
                accessibilityLabel={`${habit.name}, archived ${dayMonthShort(habit.archivedOn!)}. Open details`}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 48, paddingVertical: 10 }}
              >
                <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: t.habit[habit.color] }} />
                <Txt numberOfLines={1} style={{ flex: 1 }}>{habit.name}</Txt>
                <Txt variant="small" muted>Since {dayMonthShort(habit.archivedOn!)}</Txt>
              </Tap>
            </View>
          ))}
        </View>
      )}
    </Page>
  );
}
