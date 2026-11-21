import { ComponentRef, ReactNode, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Modal,
  Platform,
  Pressable,
  PressableProps,
  ScrollView,
  StyleProp,
  Switch,
  Text,
  TextInput,
  TextInputProps,
  TextProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DayKey, monthShort } from './logic/dates';
import type { DayStatus } from './logic/streaks';
import { Theme, fonts, useTheme } from './theme';

const TYPE = {
  display: { fontFamily: fonts.display, fontSize: 36, lineHeight: 40, letterSpacing: -0.5 },
  title: { fontFamily: fonts.display, fontSize: 24, lineHeight: 29, letterSpacing: -0.2 },
  heading: { fontFamily: fonts.medium, fontSize: 18, lineHeight: 23 },
  body: { fontSize: 16, lineHeight: 23 },
  small: { fontSize: 14, lineHeight: 20 },
} satisfies Record<string, TextStyle>;

export function Txt({ variant = 'body', muted, color, style, ...rest }: TextProps & { variant?: keyof typeof TYPE; muted?: boolean; color?: string }) {
  const t = useTheme();
  // A heading is level 1 unless told otherwise: without a level, browsers and checkers read it as level 2.
  return <Text aria-level={rest.accessibilityRole === 'header' ? 1 : undefined} {...rest} style={[TYPE[variant], { color: color ?? (muted ? t.muted : t.ink) }, style]} />;
}

/** Pressable with pressed and disabled states. Role defaults to button. */
export function Tap({ style, children, ...rest }: Omit<PressableProps, 'style' | 'children'> & { style?: StyleProp<ViewStyle>; children?: ReactNode }) {
  // react-native-web presses on Enter for every role but on Space only for buttons,
  // so Space on a checkbox, radio or tab scrolled the page instead of activating it.
  const needsSpace = Platform.OS === 'web' && (rest.accessibilityRole ?? 'button') !== 'button' && !rest.disabled;
  return (
    <Pressable
      accessibilityRole="button"
      {...rest}
      onKeyDown={
        needsSpace
          ? (e) => {
              if (e.nativeEvent.key !== ' ') return;
              e.preventDefault();
              (rest.onPress as (() => void) | undefined)?.();
            }
          : undefined
      }
      style={(s) => [
        style,
        s.pressed && { opacity: 0.6 },
        rest.disabled && { opacity: 0.4 },
      ]}
    >
      {children}
    </Pressable>
  );
}

export function Button({ label, onPress, kind = 'primary', disabled, style }: { label: string; onPress: () => void; kind?: 'primary' | 'outline' | 'danger' | 'armed'; disabled?: boolean; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  const solid = kind === 'primary' ? t.ink : kind === 'armed' ? t.danger : null;
  const edge = kind === 'danger' || kind === 'armed' ? t.danger : t.ink;
  return (
    <Tap
      onPress={onPress}
      disabled={disabled}
      aria-disabled={!!disabled}
      style={[
        { minHeight: 50, paddingHorizontal: 20, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
        { backgroundColor: solid ?? 'transparent', borderColor: edge },
        style,
      ]}
    >
      <Text style={{ fontFamily: fonts.medium, fontSize: 17, color: solid ? t.bg : edge, textAlign: 'center' }}>{label}</Text>
    </Tap>
  );
}

/** One choice out of a few; `selected` is announced as a radio. */
export function Chip({ label, selected, onPress, color, accessibilityLabel }: { label: string; selected: boolean; onPress: () => void; color?: string; accessibilityLabel?: string }) {
  const t = useTheme();
  const fill = color ?? t.ink;
  return (
    <Tap
      onPress={onPress}
      accessibilityRole="radio"
      aria-checked={selected}
      accessibilityLabel={accessibilityLabel ?? label}
      style={{ minHeight: 44, minWidth: 44, maxWidth: '100%', paddingHorizontal: 14, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: selected ? fill : t.edge, backgroundColor: selected ? fill : 'transparent' }}
    >
      <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '600', color: selected ? t.bg : t.ink }}>{label}</Text>
    </Tap>
  );
}

export function ChipRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {children}
    </View>
  );
}

export function Field({ label, hint, error, ...rest }: TextInputProps & { label: string; hint?: string; error?: string | null }) {
  const t = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <Txt variant="heading">{label}</Txt>
      {hint ? <Txt variant="small" muted>{hint}</Txt> : null}
      <TextInput
        accessibilityLabel={label}
        aria-invalid={!!error}
        placeholderTextColor={t.muted}
        {...rest}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[
          { minHeight: 50, borderWidth: 1.5, borderColor: error ? t.danger : focused ? t.ink : t.edge, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, lineHeight: 22, color: t.ink, backgroundColor: t.surface },
          rest.multiline && { minHeight: 92, textAlignVertical: 'top' },
          rest.style,
        ]}
      />
      {error ? <Txt variant="small" color={t.danger} aria-live="polite">{error}</Txt> : null}
    </View>
  );
}

export function ToggleRow({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 }}>
      <View style={{ flex: 1 }}>
        <Txt>{label}</Txt>
        {hint ? <Txt variant="small" muted>{hint}</Txt> : null}
      </View>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onChange}
        trackColor={{ true: t.habit[0], false: t.edge }}
        thumbColor="#FFFFFF"
        // Web only: without these the thumb turns teal when on, and the switch is 20px tall.
        {...(Platform.OS === 'web' ? { activeThumbColor: '#FFFFFF', style: { height: 28 } } : null)}
      />
    </View>
  );
}

/** A destructive button that asks for a second tap instead of opening a dialog; once armed it fills in. */
export function ConfirmButton({ label, confirmLabel, armed, onArm, onConfirm }: { label: string; confirmLabel: string; armed: boolean; onArm: () => void; onConfirm: () => void }) {
  return <Button kind={armed ? 'armed' : 'danger'} label={armed ? confirmLabel : label} onPress={armed ? onConfirm : onArm} />;
}

export function Section({ title, children, style }: { title?: string; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ gap: 12 }, style]}>
      {title ? <Txt variant="heading" accessibilityRole="header" aria-level={2}>{title}</Txt> : null}
      {children}
    </View>
  );
}

export function Rule() {
  const t = useTheme();
  return <View style={{ height: 1, backgroundColor: t.line }} />;
}

/** Scrolling page body, centred on wide (web) windows. */
export function Page({ children, bottomPad = 32 }: { children: ReactNode; bottomPad?: number }) {
  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 20, paddingBottom: bottomPad, gap: 28, width: '100%', maxWidth: 560, alignSelf: 'center' }}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      {children}
    </ScrollView>
  );
}

/** The system "reduce motion" setting (on the web: prefers-reduced-motion). */
export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduce, () => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => sub.remove();
  }, []);
  return reduce;
}

export function Sheet({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  // Decided when the sheet opens and kept until it opens again: on the web, a sheet whose
  // animation type changes while it slides out never finishes closing and blocks the page.
  const animation = useRef<'none' | 'slide'>('slide');
  const wasVisible = useRef(false);
  if (visible && !wasVisible.current) animation.current = reduceMotion ? 'none' : 'slide';
  wasVisible.current = visible;
  // Web: react-native-web hands focus back to whatever opened the sheet, but not when a field
  // inside took focus first (autoFocus); then a keyboard user was dropped at the top of the page.
  // Read during render because the field has focus before any effect of this component runs.
  const opener = useRef<HTMLElement | null>(null);
  if (Platform.OS === 'web' && visible && !opener.current) opener.current = document.activeElement as HTMLElement | null;
  const refocus = () => {
    opener.current?.focus();
    opener.current = null;
  };
  return (
    <Modal visible={visible} animationType={animation.current} onRequestClose={onClose} onDismiss={refocus} aria-label={title}>
      <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: insets.top, paddingBottom: insets.bottom }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 20, paddingRight: 8, minHeight: 56, width: '100%', maxWidth: 560, alignSelf: 'center' }}>
          <Txt variant="heading" accessibilityRole="header" numberOfLines={1} style={{ flex: 1 }}>{title}</Txt>
          <Tap onPress={onClose} accessibilityLabel="Close" style={{ minHeight: 44, paddingHorizontal: 12, justifyContent: 'center' }}>
            <Txt style={{ fontWeight: '600' }}>Close</Txt>
          </Tap>
        </View>
        <Rule />
        {children}
      </View>
    </Modal>
  );
}

/** A check mark drawn with borders, so it looks the same on every platform. */
export function CheckMark({ size, color }: { size: number; color: string }) {
  return (
    <View
      style={{ width: size * 0.34, height: size * 0.6, borderColor: color, borderRightWidth: size * 0.12, borderBottomWidth: size * 0.12, transform: [{ rotate: '45deg' }], marginTop: -size * 0.12 }}
    />
  );
}

export function cellStyle(t: Theme, status: DayStatus, color: string): ViewStyle {
  switch (status) {
    case 'done':
      return { backgroundColor: color };
    case 'frozen':
      return { backgroundColor: t.frost, borderWidth: 1.5, borderColor: t.frostEdge };
    case 'missed':
      return { borderWidth: 1.5, borderColor: t.muted };
    case 'open':
      return { borderWidth: 1.5, borderColor: color, borderStyle: 'dashed' };
    case 'rest':
      return { backgroundColor: t.faint };
    case 'paused':
    case 'none':
      return {};
  }
}

const STATUS_WORD: Record<DayStatus, string> = { done: 'done', frozen: 'frozen', missed: 'missed', open: 'still open', rest: 'rest day', paused: 'paused', none: 'not tracked' };
export const statusWord = (s: DayStatus) => STATUS_WORD[s];

/**
 * The streak drawn as a line: consecutive done days join into one stroke,
 * a missed day leaves a gap with a dot, a frozen day bridges it in frost.
 */
export function StreakLine({ statuses, color }: { statuses: DayStatus[]; color: string }) {
  const t = useTheme();
  const count = (s: DayStatus) => statuses.filter((x) => x === s).length;
  const joins = (s?: DayStatus) => s === 'done' || s === 'frozen';
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Last ${statuses.length} days: ${count('done')} done, ${count('missed')} missed, ${count('frozen')} frozen${count('paused') ? `, ${count('paused')} paused` : ''}`}
      style={{ flexDirection: 'row', height: 10, alignItems: 'center' }}
    >
      {statuses.map((s, i) => {
        const left = joins(statuses[i - 1]) ? 0 : 4;
        const right = joins(statuses[i + 1]) ? 0 : 4;
        const round = { borderTopLeftRadius: left, borderBottomLeftRadius: left, borderTopRightRadius: right, borderBottomRightRadius: right };
        return (
          <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', height: 10 }}>
            {s === 'done' && <View style={[{ alignSelf: 'stretch', height: 8, backgroundColor: color, marginLeft: left ? 1 : 0, marginRight: right ? 1 : 0 }, round]} />}
            {s === 'frozen' && <View style={[{ alignSelf: 'stretch', height: 8, backgroundColor: t.frost, borderTopWidth: 1.5, borderBottomWidth: 1.5, borderColor: t.frostEdge, marginLeft: left ? 1 : 0, marginRight: right ? 1 : 0 }, round]} />}
            {s === 'missed' && <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: t.muted }} />}
            {s === 'open' && <View style={{ width: 8, height: 8, borderRadius: 4, borderWidth: 1.5, borderColor: color }} />}
            {s === 'paused' && <View style={{ alignSelf: 'stretch', height: 0, borderTopWidth: 2, borderStyle: 'dotted', borderColor: t.muted }} />}
            {s === 'rest' && <View style={{ alignSelf: 'stretch', height: 2, backgroundColor: t.line }} />}
          </View>
        );
      })}
    </View>
  );
}

const LINE_LEGEND: [string, DayStatus[]][] = [['Done', ['done', 'done']], ['Missed', ['missed']], ['Frozen', ['frozen', 'frozen']], ['Rest', ['rest', 'rest']], ['Paused', ['paused', 'paused']]];

/** What the marks on a streak line mean. For the eye only: each line already carries a spoken summary. */
export function StreakLineLegend() {
  const t = useTheme();
  return (
    <View aria-hidden style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 6 }}>
      {LINE_LEGEND.map(([label, statuses]) => (
        <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: statuses.length * 12 }}>
            <StreakLine statuses={statuses} color={t.ink} />
          </View>
          <Txt variant="small" muted>{label}</Txt>
        </View>
      ))}
    </View>
  );
}

const CELL = 14;
const GAP = 3;

/** A year of Monday-first week columns; scrolls sideways and opens on the most recent weeks. */
export function Heatmap({ weeks, cell, label }: { weeks: DayKey[][]; cell: (day: DayKey) => ViewStyle; label: string }) {
  const t = useTheme();
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  // Show whole week columns only, so the left edge never cuts a cell in half.
  const [room, setRoom] = useState(0);
  const columns = Math.min(weeks.length, Math.floor((room + GAP) / (CELL + GAP)));
  // A month label is wider than its column. At rest (scrolled to the newest weeks) the label
  // of the column just out of view would poke in as a cut-off letter or two, so it is left out.
  const [atEnd, setAtEnd] = useState(true);
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label} style={{ flexDirection: 'row', gap: 6 }}>
      <View style={{ paddingTop: 20, gap: GAP }}>
        {['M', '', 'W', '', 'F', '', 'S'].map((d, i) => (
          <Text key={i} style={{ height: CELL, fontSize: 11, lineHeight: CELL, color: t.muted }}>{d}</Text>
        ))}
      </View>
      <View style={{ flex: 1, alignItems: 'flex-end' }} onLayout={(e) => setRoom(e.nativeEvent.layout.width)}>
      <ScrollView
        ref={scroll}
        horizontal
        tabIndex={0} // keyboard: focus it and the arrow keys scroll back through the year
        showsHorizontalScrollIndicator={false}
        style={{ width: Math.max(0, columns * (CELL + GAP) - GAP), flexGrow: 0 }}
        onLayout={() => scroll.current?.scrollToEnd({ animated: false })}
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })}
        scrollEventThrottle={32}
        onScroll={({ nativeEvent: e }) => setAtEnd(e.contentOffset.x + e.layoutMeasurement.width >= e.contentSize.width - 1)}
      >
        <View style={{ flexDirection: 'row', gap: GAP }}>
          {weeks.map((week, i) => {
            // Label the column in which a month starts.
            const first = !(atEnd && i === weeks.length - columns - 1) && week.find((d) => d.endsWith('-01'));
            return (
              <View key={week[0]} style={{ gap: GAP, width: CELL }}>
                <View style={{ height: 20 - GAP }}>
                  {first && <Text style={{ position: 'absolute', left: 0, width: 40, fontSize: 11, color: t.muted }}>{monthShort(first)}</Text>}
                </View>
                {week.map((day) => (
                  <View key={day} style={[{ width: CELL, height: CELL, borderRadius: 4 }, cell(day)]} />
                ))}
              </View>
            );
          })}
        </View>
      </ScrollView>
      </View>
    </View>
  );
}

export function LegendItem({ label, style }: { label: string; style: ViewStyle }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={[{ width: CELL, height: CELL, borderRadius: 4 }, style]} />
      <Txt variant="small" muted>{label}</Txt>
    </View>
  );
}
