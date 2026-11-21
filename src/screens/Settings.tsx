import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { exportBackup, parseBackup } from '../logic/backup';
import { normalizeTime } from '../logic/reminders';
import { Data, EMPTY_DATA, Settings as SettingsType } from '../logic/types';
import { pickTextFile, saveTextFile } from '../files';
import { notificationsAllowed, notificationsSupported, onNotificationsSynced } from '../notifications';
import { useStore } from '../store';
import { useTheme } from '../theme';
import { Button, Chip, ChipRow, ConfirmButton, Field, Page, Section, ToggleRow, Txt } from '../ui';

const THEMES: { value: SettingsType['theme']; label: string }[] = [
  { value: 'system', label: 'Match phone' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

const summary = (d: Data) => {
  const checkins = Object.values(d.checkins).reduce((n, list) => n + list.length, 0);
  return `${d.habits.length} ${d.habits.length === 1 ? 'habit' : 'habits'}, ${checkins} check-ins, ${d.sessions.length} focus sessions, ${Object.keys(d.reflections).length} reflections`;
};

export function Settings({ version }: { version: string }) {
  const { data, dispatch, today } = useStore();
  const t = useTheme();
  const s = data.settings;
  const set = (patch: Partial<SettingsType>) => dispatch({ type: 'settings/set', patch });

  const [reminder, setReminder] = useState(s.reflectionReminder ?? '');
  const reminderError = reminder.trim() && !normalizeTime(reminder) ? 'Use 24-hour time, like 21:00.' : null;
  const [allowed, setAllowed] = useState(true);
  useEffect(() => {
    const check = () => void notificationsAllowed().then(setAllowed, () => {});
    check();
    // Checking only when a reminder is set would read the permission before the system prompt is answered.
    return onNotificationsSynced(check);
  }, []);

  const [pending, setPending] = useState<Data | null>(null);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [armed, setArmed] = useState(false);

  const doExport = async () => {
    try {
      await saveTextFile(`streakline-backup-${today}.json`, exportBackup(data, new Date()));
      setMessage({ text: 'Backup file created.' });
    } catch (e) {
      setMessage({ text: `Could not export: ${e instanceof Error ? e.message : String(e)}`, error: true });
    }
  };

  const doPick = async () => {
    setMessage(null);
    setPending(null);
    try {
      const text = await pickTextFile();
      if (text === null) return;
      const result = parseBackup(text);
      if (result.ok) setPending(result.data);
      else setMessage({ text: `Nothing was imported. ${result.error}`, error: true });
    } catch (e) {
      setMessage({ text: `Could not read the file: ${e instanceof Error ? e.message : String(e)}`, error: true });
    }
  };

  return (
    <Page>
      <View style={{ gap: 2 }}>
        <Txt muted>Streakline {version}</Txt>
        <Txt variant="display" accessibilityRole="header">Settings</Txt>
      </View>

      <Section title="Appearance">
        <ChipRow label="Theme">
          {THEMES.map((o) => (
            <Chip key={o.value} label={o.label} selected={s.theme === o.value} onPress={() => set({ theme: o.value })} />
          ))}
        </ChipRow>
        <ToggleRow label="Haptics" hint="A light tap when you check in or a timer ends." value={s.haptics} onChange={(haptics) => set({ haptics })} />
      </Section>

      <Section title="Focus timer">
        <ToggleRow label="Check in when a session ends" hint="Finishing a focus session for a habit marks it done for the day." value={s.autoCheckIn} onChange={(autoCheckIn) => set({ autoCheckIn })} />
        <Txt>Break length</Txt>
        <ChipRow label="Break length">
          {[5, 10, 15].map((m) => (
            <Chip key={m} label={`${m} min`} selected={s.breakMinutes === m} onPress={() => set({ breakMinutes: m })} />
          ))}
        </ChipRow>
      </Section>

      {notificationsSupported ? (
        <View style={{ gap: 8 }}>
          <Field
            label="Evening reflection reminder"
            hint="Optional. A daily notification at this time. Leave empty for none."
            value={reminder}
            onChangeText={(text) => {
              setReminder(text);
              const time = normalizeTime(text);
              if (time || !text.trim()) set({ reflectionReminder: time });
            }}
            placeholder="21:00"
            maxLength={5}
            keyboardType="numbers-and-punctuation"
            error={reminderError}
          />
          {!allowed && (s.reflectionReminder || data.habits.some((h) => h.reminder && !h.archivedOn)) && (
            <Txt variant="small" color={t.danger}>Notifications are turned off for this app in your phone's settings, so reminders will not appear.</Txt>
          )}
        </View>
      ) : (
        <Section title="Reminders">
          <Txt variant="small" muted>Reminders need the phone app; a browser tab cannot schedule them.</Txt>
        </Section>
      )}

      <Section title="Your data">
        <Txt variant="small" muted>Everything stays on this device: {summary(data)}. A backup is one JSON file you can keep anywhere.</Txt>
        <Button kind="outline" label="Export backup" onPress={doExport} />
        <Button kind="outline" label="Import backup" onPress={doPick} />
        {message && <Txt variant="small" color={message.error ? t.danger : t.ink} aria-live="polite">{message.text}</Txt>}
        {pending && (
          <View style={{ gap: 12, padding: 16, borderRadius: 14, borderWidth: 1.5, borderColor: t.ink }}>
            <Txt style={{ fontWeight: '600' }}>Replace everything on this device?</Txt>
            <Txt variant="small">The backup holds {summary(pending)}. It replaces what is here now: {summary(data)}.</Txt>
            <Button
              label="Replace my data"
              onPress={() => {
                dispatch({ type: 'data/replace', data: pending });
                setReminder(pending.settings.reflectionReminder ?? '');
                setPending(null);
                setMessage({ text: 'Backup imported.' });
              }}
            />
            <Button kind="outline" label="Keep what I have" onPress={() => setPending(null)} />
          </View>
        )}
        <ConfirmButton
          label="Erase all data"
          confirmLabel="Tap again to erase everything"
          armed={armed}
          onArm={() => setArmed(true)}
          onConfirm={() => {
            dispatch({ type: 'data/replace', data: EMPTY_DATA });
            setReminder('');
            setArmed(false);
            setMessage({ text: 'All data erased.' });
          }}
        />
      </Section>

      <Txt variant="small" muted>No account, no server, no tracking.</Txt>
    </Page>
  );
}
