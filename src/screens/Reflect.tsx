import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { success } from '../haptics';
import { dayMonthLong, weekdayLong } from '../logic/dates';
import { MAX_ANSWER_LENGTH } from '../logic/types';
import { useStore } from '../store';
import { Button, Field, Page, Rule, Section, Txt } from '../ui';

export const PROMPTS = ['What went well today?', 'What got in the way?', 'What is the one thing for tomorrow?'];
type Answers = [string, string, string];
const EMPTY: Answers = ['', '', ''];

export function Reflect() {
  const { data, dispatch, today } = useStore();
  const saved = data.reflections[today]?.answers ?? EMPTY;
  const [draft, setDraft] = useState<Answers>(saved);
  const dirty = draft.some((a, i) => a.trim() !== saved[i]);

  // Keep what was typed if the user leaves the tab without pressing save.
  const latest = useRef({ draft, dirty, today });
  latest.current = { draft, dirty, today };
  useEffect(
    () => () => {
      const l = latest.current;
      if (l.dirty) dispatch({ type: 'reflection/save', day: l.today, answers: l.draft });
    },
    [dispatch],
  );
  // At midnight, what was typed belongs to the day that just ended; the new day starts empty.
  const shownDay = useRef(today);
  useEffect(() => {
    if (shownDay.current === today) return;
    if (latest.current.draft.some((a) => a.trim())) dispatch({ type: 'reflection/save', day: shownDay.current, answers: latest.current.draft });
    shownDay.current = today;
    setDraft(data.reflections[today]?.answers ?? EMPTY);
  }, [today]); // eslint-disable-line react-hooks/exhaustive-deps

  const earlier = Object.keys(data.reflections).filter((d) => d < today).sort().reverse().slice(0, 30);

  return (
    <Page>
      <View style={{ gap: 2 }}>
        <Txt muted>Evening reflection, {weekdayLong(today)}</Txt>
        <Txt variant="display" accessibilityRole="header">Two minutes on today</Txt>
      </View>

      <View style={{ gap: 20 }}>
        {PROMPTS.map((prompt, i) => (
          <Field
            key={prompt}
            label={prompt}
            value={draft[i]}
            onChangeText={(text) => setDraft(draft.map((a, j) => (j === i ? text : a)) as Answers)}
            multiline
            maxLength={MAX_ANSWER_LENGTH}
          />
        ))}
        <Button
          label={dirty ? 'Save reflection' : data.reflections[today] ? 'Saved' : 'Save reflection'}
          disabled={!dirty}
          onPress={() => {
            dispatch({ type: 'reflection/save', day: today, answers: draft });
            success(data.settings.haptics);
          }}
        />
      </View>

      {earlier.length > 0 && (
        <Section title="Earlier">
          {earlier.map((day, i) => (
            <View key={day} style={{ gap: 10 }}>
              {i > 0 && <Rule />}
              <Txt style={{ fontWeight: '600' }}>{weekdayLong(day)}, {dayMonthLong(day)}</Txt>
              {data.reflections[day].answers.map((answer, j) =>
                answer ? (
                  <View key={j}>
                    <Txt variant="small" muted>{PROMPTS[j]}</Txt>
                    <Txt>{answer}</Txt>
                  </View>
                ) : null,
              )}
            </View>
          ))}
        </Section>
      )}
    </Page>
  );
}
