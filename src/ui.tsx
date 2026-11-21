import { ComponentRef, ReactNode, useRef } from 'react';
import {
  Modal,
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
  return <Text {...rest} style={[TYPE[variant], { color: color ?? (muted ? t.muted : t.ink) }, style]} />;
}

/** Pressable with pressed and disabled states. Role defaults to button. */
export function Tap({ style, children, ...rest }: Omit<PressableProps, 'style' | 'children'> & { style?: StyleProp<ViewStyle>; children?: ReactNode }) {
  return (
    <Pressable
      accessibilityRole="button"
      {...rest}
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

export function Button({ label, onPress, kind = 'primary', disabled, style }: { label: string; onPress: () => void; kind?: 'primary' | 'outline' | 'danger'; disabled?: boolean; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  const fg = kind === 'primary' ? t.bg : kind === 'danger' ? t.danger : t.ink;
  return (
    <Tap
      onPress={onPress}
      disabled={disabled}
      aria-disabled={!!disabled}
      style={[
        { minHeight: 50, paddingHorizontal: 20, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
        { backgroundColor: kind === 'primary' ? t.ink : 'transparent', borderColor: kind === 'danger' ? t.danger : t.ink },
        style,
      ]}
    >
      <Text style={{ fontFamily: fonts.medium, fontSize: 17, color: fg, textAlign: 'center' }}>{label}</Text>
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
      style={{ minHeight: 44, minWidth: 44, paddingHorizontal: 14, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: selected ? fill : t.line, backgroundColor: selected ? fill : 'transparent' }}
    >
      <Text style={{ fontSize: 15, fontWeight: '600', color: selected ? t.bg : t.ink }}>{label}</Text>
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
  return (
    <View style={{ gap: 6 }}>
      <Txt variant="heading">{label}</Txt>
      {hint ? <Txt variant="small" muted>{hint}</Txt> : null}
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={t.muted}
        {...rest}
        style={[
          { minHeight: 50, borderWidth: 1.5, borderColor: error ? t.danger : t.line, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, lineHeight: 22, color: t.ink, backgroundColor: t.surface },
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
      <Switch accessibilityLabel={label} value={value} onValueChange={onChange} trackColor={{ true: t.habit[0], false: t.line }} />
    </View>
  );
}

/** A destructive button that asks for a second tap instead of opening a dialog. */
export function ConfirmButton({ label, confirmLabel, armed, onArm, onConfirm }: { label: string; confirmLabel: string; armed: boolean; onArm: () => void; onConfirm: () => void }) {
  return <Button kind="danger" label={armed ? confirmLabel : label} onPress={armed ? onConfirm : onArm} />;
}

export function Section({ title, children, style }: { title?: string; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ gap: 12 }, style]}>
      {title ? <Txt variant="heading" accessibilityRole="header">{title}</Txt> : null}
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

export function Sheet({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
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
    case 'none':
      return {};
  }
}

const STATUS_WORD: Record<DayStatus, string> = { done: 'done', frozen: 'frozen', missed: 'missed', open: 'still open', rest: 'rest day', none: 'not tracked' };
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
      accessibilityLabel={`Last ${statuses.length} days: ${count('done')} done, ${count('missed')} missed, ${count('frozen')} frozen`}
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
            {s === 'rest' && <View style={{ alignSelf: 'stretch', height: 2, backgroundColor: t.line }} />}
          </View>
        );
      })}
    </View>
  );
}

const CELL = 14;
const GAP = 3;

/** A year of Monday-first week columns; scrolls sideways and opens on the most recent weeks. */
export function Heatmap({ weeks, cell, label }: { weeks: DayKey[][]; cell: (day: DayKey) => ViewStyle; label: string }) {
  const t = useTheme();
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label} style={{ flexDirection: 'row', gap: 6 }}>
      <View style={{ paddingTop: 20, gap: GAP }}>
        {['M', '', 'W', '', 'F', '', 'S'].map((d, i) => (
          <Text key={i} style={{ height: CELL, fontSize: 11, lineHeight: CELL, color: t.muted }}>{d}</Text>
        ))}
      </View>
      <ScrollView ref={scroll} horizontal showsHorizontalScrollIndicator={false} onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })}>
        <View style={{ flexDirection: 'row', gap: GAP }}>
          {weeks.map((week) => {
            // Label the column in which a month starts.
            const first = week.find((d) => d.endsWith('-01'));
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
