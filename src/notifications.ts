import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { PlannedReminder } from './logic/reminders';

/** Local notifications exist on iOS and Android only; the web build loads notifications.web.ts instead. */
export const notificationsSupported = true;

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

export async function notificationsAllowed(): Promise<boolean> {
  return (await Notifications.getPermissionsAsync()).granted;
}

async function ensurePermission(ask: boolean): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!ask || !current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

type OneOff = { at: number; title: string; body: string };

async function apply(plan: PlannedReminder[], timerEnd: OneOff | null, ask: boolean): Promise<void> {
  // The whole schedule is small, so replace it rather than track ids.
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (plan.length === 0 && !timerEnd) return;
  // The channel comes first: per Expo's docs, Android 13+ does not show the permission prompt until one exists.
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('reminders', { name: 'Reminders', importance: Notifications.AndroidImportance.DEFAULT });
  }
  if (!(await ensurePermission(ask))) return;
  const channelId = 'reminders';
  for (const { title, body, hour, minute, weekday } of plan) {
    await Notifications.scheduleNotificationAsync({
      content: { title, body },
      trigger:
        weekday === undefined
          ? { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute, channelId }
          : // Expo counts weekdays from 1 = Sunday.
            { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: weekday + 1, hour, minute, channelId },
    });
  }
  if (timerEnd && timerEnd.at > Date.now()) {
    await Notifications.scheduleNotificationAsync({
      content: { title: timerEnd.title, body: timerEnd.body },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: timerEnd.at, channelId },
    });
  }
}

let queue: Promise<void> = Promise.resolve();
const listeners = new Set<() => void>();

/** Calls `f` after every sync, which is when the permission may have changed (the system prompt is answered during one). Returns an unsubscribe. */
export function onNotificationsSynced(f: () => void): () => void {
  listeners.add(f);
  return () => void listeners.delete(f);
}

/**
 * Make the device's scheduled notifications match the plan. Calls run one at a
 * time. `ask` allows the system permission prompt; pass false for background refreshes.
 */
export function syncNotifications(plan: PlannedReminder[], timerEnd: OneOff | null, ask: boolean): void {
  queue = queue
    .then(() => apply(plan, timerEnd, ask))
    .catch((e) => console.warn('Could not schedule notifications', e))
    .then(() => listeners.forEach((f) => f()));
}
