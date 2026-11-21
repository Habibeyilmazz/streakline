import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { addDays, rangeLabel, weekStart } from '../logic/dates';
import { dayLevels, weekReview, yearGrid } from '../logic/stats';
import { useStore } from '../store';
import { useTheme } from '../theme';
import { Heatmap, LegendItem, Page, Rule, Section, Tap, Txt, cellStyle, statusWord } from '../ui';
import { formatMinutes } from './HabitDetail';

const percent = (rate: number) => `${Math.round(rate * 100)}%`;
const LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const LEVEL_OPACITY = [0, 0.3, 0.5, 0.75, 1];

export function Review() {
  const { data, today } = useStore();
  const t = useTheme();
  const thisWeek = weekStart(today);
  const [start, setStart] = useState(thisWeek);
  const current = start === thisWeek;
  const r = useMemo(() => weekReview(data, start, today), [data, start, today]);
  const prev = useMemo(() => weekReview(data, addDays(start, -7), today), [data, start, today]);
  const weeks = useMemo(() => yearGrid(today), [today]);
  const levels = useMemo(() => dayLevels(data, weeks.flat(), today), [data, weeks, today]);

  const parts = [
    r.missed > 0 && `${r.missed} missed`,
    r.open > 0 && `${r.open} still open`,
    r.frozen > 0 && `${r.frozen} frozen`,
  ].filter(Boolean);

  const arrow = (label: string, delta: number, disabled?: boolean) => (
    <Tap onPress={() => setStart(addDays(start, delta))} disabled={disabled} accessibilityLabel={label} style={{ width: 48, height: 48, borderRadius: 24, borderWidth: 1.5, borderColor: t.line, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: 11, height: 11, borderColor: t.ink, borderLeftWidth: 2.5, borderBottomWidth: 2.5, transform: [{ rotate: delta < 0 ? '45deg' : '-135deg' }], marginLeft: delta < 0 ? 4 : -4 }} />
    </Tap>
  );

  return (
    <Page>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Txt muted>{current ? 'This week so far' : start === addDays(thisWeek, -7) ? 'Last week' : 'Week of'}</Txt>
          <Txt variant="display" accessibilityRole="header" style={{ fontSize: 30, lineHeight: 35 }}>{rangeLabel(r.start, r.end)}</Txt>
        </View>
        {arrow('Previous week', -7)}
        {arrow('Next week', 7, current)}
      </View>

      <View style={{ gap: 6 }}>
        {r.rate === null ? (
          <Txt variant="title">Nothing was due this week.</Txt>
        ) : (
          <Txt variant="title">
            {r.done} of {r.due} check-ins kept, {percent(r.rate)}.
          </Txt>
        )}
        {parts.length > 0 && <Txt>{parts.join(', ')}.</Txt>}
        {prev.rate !== null && (
          <Txt muted>
            The week before: {prev.done} of {prev.due}, {percent(prev.rate)}.
          </Txt>
        )}
      </View>

      {r.habits.length > 0 && (
        <Section title="By habit">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }} aria-hidden>
            <View style={{ flex: 1 }} />
            <View style={{ flexDirection: 'row', gap: 3 }}>
              {LETTERS.map((l, i) => (
                <Txt key={i} variant="small" muted style={{ width: 20, textAlign: 'center' }}>{l}</Txt>
              ))}
            </View>
            <View style={{ width: 34 }} />
          </View>
          {r.habits.map((h, i) => (
            <View key={h.habit.id} style={{ gap: 12 }}>
              {i > 0 && <Rule />}
              <View
                accessible
                accessibilityLabel={`${h.habit.name}: ${h.done} of ${h.due}. ${h.days.map((s, d) => `${DAY_NAMES[d]} ${statusWord(s)}`).join(', ')}`}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
              >
                <View style={{ flex: 1 }}>
                  <Txt numberOfLines={2} style={{ fontWeight: '600' }}>{h.habit.name}</Txt>
                  {h.focusMinutes > 0 && <Txt variant="small" muted>{formatMinutes(h.focusMinutes)} focus</Txt>}
                </View>
                <View style={{ flexDirection: 'row', gap: 3 }}>
                  {h.days.map((s, d) => (
                    <View key={d} style={[{ width: 20, height: 20, borderRadius: 6 }, cellStyle(t, s, t.habit[h.habit.color])]} />
                  ))}
                </View>
                <Txt style={{ width: 34, textAlign: 'right', fontWeight: '600' }}>{h.done}/{h.due}</Txt>
              </View>
            </View>
          ))}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
            <LegendItem label="Done" style={cellStyle(t, 'done', t.ink)} />
            <LegendItem label="Missed" style={cellStyle(t, 'missed', t.ink)} />
            <LegendItem label="Frozen" style={cellStyle(t, 'frozen', t.ink)} />
            <LegendItem label="Rest" style={cellStyle(t, 'rest', t.ink)} />
          </View>
        </Section>
      )}

      <Section title="Focus and reflection">
        <Txt>
          {r.sessions === 0 ? 'No focus sessions.' : `${formatMinutes(r.focusMinutes)} of focus in ${r.sessions} ${r.sessions === 1 ? 'session' : 'sessions'}.`}
        </Txt>
        <Txt>
          {r.reflections === 0 ? 'No evening reflections written.' : `Reflected on ${r.reflections} of 7 evenings.`}
        </Txt>
      </Section>

      {data.habits.length > 0 && (
        <Section title="All habits, past year">
          <Heatmap
            weeks={weeks}
            label="Past year across all habits. Darker days had more of what was due done."
            cell={(day) => {
              const level = levels.get(day) ?? 0;
              return day > today ? {} : level === 0 ? { backgroundColor: t.faint } : { backgroundColor: t.ink, opacity: LEVEL_OPACITY[level] };
            }}
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Txt variant="small" muted>None</Txt>
            {[0, 1, 2, 3, 4].map((l) => (
              <View key={l} style={[{ width: 14, height: 14, borderRadius: 4 }, l === 0 ? { backgroundColor: t.faint } : { backgroundColor: t.ink, opacity: LEVEL_OPACITY[l] }]} />
            ))}
            <Txt variant="small" muted>All done</Txt>
          </View>
        </Section>
      )}
    </Page>
  );
}
