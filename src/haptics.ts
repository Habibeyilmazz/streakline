import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

// Haptics are a nicety: never let a failure (web, unsupported device) surface.
const run = (enabled: boolean, f: () => Promise<void>) => {
  if (enabled && Platform.OS !== 'web') f().catch(() => {});
};

export const tap = (enabled: boolean) => run(enabled, () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
export const success = (enabled: boolean) => run(enabled, () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
