import { useState } from 'react';
import { View } from 'react-native';

import { WEEKDAYS_SHORT } from '../logic/dates';
import { parseTime } from '../logic/reminders';
import { HABIT_COLOR_COUNT, Habit, MAX_HABITS, MAX_NAME_LENGTH, Schedule } from '../logic/types';
import { notificationsSupported } from '../notifications';
import { newId, useStore } from '../store';
import { HABIT_COLOR_NAMES, useTheme } from '../theme';
import { Button, Chip, ChipRow, ConfirmButton, Field, Page, Section, Tap, Txt } from '../ui';

const KINDS: { kind: Schedule['kind']; label: string }[] = [
  { kind: 'daily', label: 'Every day' },
  { kind: 'weekdays', label: 'Certain days' },
  { kind: 'weekly', label: 'Times a week' },
];
const MONDAY_FIRST = [1, 2, 3, 4, 5, 6, 0];

/** Create a habit, or edit `habit` when given. Calls onDone after saving or deleting. */
export function HabitEditor({ habit, onDone }: { habit?: Habit; onDone: (deleted?: boolean) => void }) {
  const { data, dispatch, today } = useStore();
  const t = useTheme();
  const [name, setName] = useState(habit?.name ?? '');
  const [color, setColor] = useState(habit?.color ?? 0);
  const [kind, setKind] = useState<Schedule['kind']>(habit?.schedule.kind ?? 'daily');
  const [days, setDays] = useState<number[]>(habit?.schedule.kind === 'weekdays' ? habit.schedule.days : [1, 2, 3, 4, 5]);
  const [times, setTimes] = useState(habit?.schedule.kind === 'weekly' ? habit.schedule.times : 3);
  const [reminder, setReminder] = useState(habit?.reminder ?? '');
  const [tried, setTried] = useState(false);
  const [armed, setArmed] = useState(false);

  const trimmed = name.trim();
  const nameError = !trimmed
    ? 'Give the habit a name.'
    : trimmed.length > MAX_NAME_LENGTH // emoji count double, so maxLength alone does not guarantee this
      ? 'That name is too long. Shorten it a little.'
      : !habit && data.habits.length >= MAX_HABITS
        ? `You have reached the limit of ${MAX_HABITS} habits.`
        : null;
  const daysError = kind === 'weekdays' && days.length === 0 ? 'Pick at least one day.' : null;
  const reminderError = reminder && !parseTime(reminder) ? 'Use 24-hour time, like 07:30 or 21:00.' : null;

  const save = () => {
    setTried(true);
    if (nameError || daysError || reminderError) return;
    const schedule: Schedule = kind === 'daily' ? { kind } : kind === 'weekly' ? { kind, times } : { kind, days: [...days].sort() };
    dispatch({
      type: 'habit/save',
      habit: { id: habit?.id ?? newId(), name: trimmed, color, schedule, createdOn: habit?.createdOn ?? today, reminder: reminder || null },
    });
    onDone();
  };

  return (
    <Page>
      <Field label="Name" value={name} onChangeText={setName} maxLength={MAX_NAME_LENGTH} placeholder="Read 20 pages" autoFocus={!habit} returnKeyType="done" error={tried ? nameError : null} />

      <Section title="How often">
        <ChipRow label="How often">
          {KINDS.map((k) => (
            <Chip key={k.kind} label={k.label} selected={kind === k.kind} onPress={() => setKind(k.kind)} />
          ))}
        </ChipRow>
        {kind === 'weekdays' && (
          <View style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {MONDAY_FIRST.map((d) => {
                const on = days.includes(d);
                return (
                  <Tap
                    key={d}
                    onPress={() => setDays(on ? days.filter((x) => x !== d) : [...days, d])}
                    accessibilityRole="checkbox"
                    aria-checked={on}
                    accessibilityLabel={WEEKDAYS_SHORT[d]}
                    style={{ flex: 1, minHeight: 46, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', borderColor: on ? t.ink : t.line, backgroundColor: on ? t.ink : 'transparent' }}
                  >
                    <Txt variant="small" color={on ? t.bg : t.ink} style={{ fontWeight: '600' }}>{WEEKDAYS_SHORT[d]}</Txt>
                  </Tap>
                );
              })}
            </View>
            {tried && daysError ? <Txt variant="small" color={t.danger}>{daysError}</Txt> : null}
          </View>
        )}
        {kind === 'weekly' && (
          <View style={{ gap: 6 }}>
            <ChipRow label="Times a week">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <Chip key={n} label={String(n)} selected={times === n} onPress={() => setTimes(n)} accessibilityLabel={`${n} times a week`} />
              ))}
            </ChipRow>
            <Txt variant="small" muted>Any days you like, counted Monday to Sunday.</Txt>
          </View>
        )}
      </Section>

      <Section title="Colour">
        <ChipRow label="Colour">
          {Array.from({ length: HABIT_COLOR_COUNT }, (_, i) => (
            <Tap
              key={i}
              onPress={() => setColor(i)}
              accessibilityRole="radio"
              aria-checked={color === i}
              accessibilityLabel={HABIT_COLOR_NAMES[i]}
              style={{ width: 46, height: 46, borderRadius: 23, borderWidth: 2, borderColor: color === i ? t.ink : 'transparent', alignItems: 'center', justifyContent: 'center' }}
            >
              <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: t.habit[i] }} />
            </Tap>
          ))}
        </ChipRow>
      </Section>

      {notificationsSupported ? (
        <Field
          label="Reminder"
          hint="Optional. A notification at this time on the days the habit is due."
          value={reminder}
          onChangeText={setReminder}
          placeholder="07:30"
          maxLength={5}
          keyboardType="numbers-and-punctuation"
          error={tried ? reminderError : null}
        />
      ) : (
        <Section title="Reminder">
          <Txt variant="small" muted>Reminders need the phone app; a browser tab cannot schedule them.</Txt>
        </Section>
      )}

      <View style={{ gap: 12 }}>
        <Button label={habit ? 'Save changes' : 'Add habit'} onPress={save} />
        {habit && (
          <>
            <ConfirmButton
              label="Delete habit"
              confirmLabel="Tap again to delete for good"
              armed={armed}
              onArm={() => setArmed(true)}
              onConfirm={() => {
                dispatch({ type: 'habit/delete', id: habit.id });
                onDone(true);
              }}
            />
            <Txt variant="small" muted>Deleting removes this habit's check-ins and freezes. Focus time already logged stays in your totals.</Txt>
          </>
        )}
      </View>
    </Page>
  );
}
