import { BricolageGrotesque_500Medium } from '@expo-google-fonts/bricolage-grotesque/500Medium';
import { BricolageGrotesque_700Bold } from '@expo-google-fonts/bricolage-grotesque/700Bold';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View, useColorScheme } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { version } from './package.json';
import type { State } from './src/logic/reducer';
import { Focus } from './src/screens/Focus';
import { HabitDetail } from './src/screens/HabitDetail';
import { HabitEditor } from './src/screens/HabitEditor';
import { Reflect } from './src/screens/Reflect';
import { Review } from './src/screens/Review';
import { Settings } from './src/screens/Settings';
import { Today } from './src/screens/Today';
import { StoreProvider, loadState, useStore } from './src/store';
import { ThemeContext, dark, light } from './src/theme';
import { Button, Sheet, Tap, Txt } from './src/ui';

const TABS = ['Today', 'Focus', 'Reflect', 'Review', 'Settings'] as const;
type Tab = (typeof TABS)[number];
type SheetState = null | { kind: 'new' } | { kind: 'detail' | 'edit'; id: string };

function Shell() {
  const { data, timer, saveFailed } = useStore();
  const scheme = useColorScheme();
  const theme = (data.settings.theme === 'system' ? scheme : data.settings.theme) === 'dark' ? dark : light;
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('Today');
  const [sheet, setSheet] = useState<SheetState>(null);
  const close = () => setSheet(null);
  const habit = sheet && sheet.kind !== 'new' ? data.habits.find((h) => h.id === sheet.id) : undefined;

  return (
    <ThemeContext.Provider value={theme}>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      <View style={{ flex: 1, backgroundColor: theme.bg, paddingTop: insets.top }}>
        {saveFailed && (
          <View accessibilityRole="alert" style={{ backgroundColor: theme.danger, padding: 12 }}>
            <Text style={{ color: theme.bg, fontSize: 14, textAlign: 'center' }}>Your last change could not be saved to this device. Export a backup from Settings.</Text>
          </View>
        )}

        {tab === 'Today' && <Today onOpen={(id) => setSheet({ kind: 'detail', id })} onAdd={() => setSheet({ kind: 'new' })} />}
        {tab === 'Focus' && <Focus />}
        {tab === 'Reflect' && <Reflect />}
        {tab === 'Review' && <Review />}
        {tab === 'Settings' && <Settings version={version} />}

        <View accessibilityRole="tablist" style={{ borderTopWidth: 1, borderColor: theme.line, backgroundColor: theme.surface, paddingBottom: insets.bottom }}>
          <View style={{ flexDirection: 'row', width: '100%', maxWidth: 560, alignSelf: 'center' }}>
            {TABS.map((name) => {
              const selected = tab === name;
              const live = name === 'Focus' && timer !== null;
              return (
                <Tap
                  key={name}
                  onPress={() => setTab(name)}
                  accessibilityRole="tab"
                  aria-selected={selected}
                  accessibilityLabel={live ? 'Focus, timer active' : name}
                  style={{ flex: 1, minHeight: 56, alignItems: 'center', justifyContent: 'center', gap: 6 }}
                >
                  {/* The selected tab carries a short stroke, like a streak. */}
                  <View style={{ width: 28, height: 4, borderRadius: 2, backgroundColor: selected ? theme.ink : live ? theme.habit[3] : 'transparent' }} />
                  <Text style={{ fontSize: 13, fontWeight: selected ? '700' : '500', color: selected ? theme.ink : theme.muted }}>{name}</Text>
                </Tap>
              );
            })}
          </View>
        </View>
      </View>

      <Sheet visible={sheet !== null} title={sheet?.kind === 'new' ? 'New habit' : sheet?.kind === 'edit' ? 'Edit habit' : 'Habit'} onClose={close}>
        {sheet?.kind === 'new' && <HabitEditor onDone={close} />}
        {sheet?.kind === 'detail' && habit && <HabitDetail habit={habit} onEdit={() => setSheet({ kind: 'edit', id: habit.id })} />}
        {sheet?.kind === 'edit' && habit && <HabitEditor habit={habit} onDone={(deleted) => (deleted ? close() : setSheet({ kind: 'detail', id: habit.id }))} />}
      </Sheet>
    </ThemeContext.Provider>
  );
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({ BricolageGrotesque_500Medium, BricolageGrotesque_700Bold });
  const [initial, setInitial] = useState<State | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const load = () => {
    setLoadFailed(false);
    loadState().then(setInitial, () => setLoadFailed(true));
  };
  useEffect(load, []);

  let body;
  if (loadFailed) {
    // Starting empty here would overwrite whatever is stored, so stop instead.
    body = (
      <ThemeContext.Provider value={light}>
        <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 16, backgroundColor: light.bg }}>
          <Txt variant="title">Your data could not be read from this device.</Txt>
          <Txt muted>Nothing has been changed. Try again, or restart the app.</Txt>
          <Button label="Try again" onPress={load} />
        </View>
      </ThemeContext.Provider>
    );
  } else if (!initial || (!fontsLoaded && !fontError)) {
    body = (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: light.bg }}>
        <ActivityIndicator accessibilityLabel="Loading" color={light.ink} />
      </View>
    );
  } else {
    body = (
      <StoreProvider initial={initial}>
        <Shell />
      </StoreProvider>
    );
  }
  return <SafeAreaProvider>{body}</SafeAreaProvider>;
}
