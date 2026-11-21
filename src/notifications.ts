import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { PlannedReminder } from './logic/reminders';

/** Local notifications exist on iOS and Android only. */
export const notificationsSupported = Platform.OS !== 'web';

if (notificationsSupported) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
}

export async function notificationsAllowed(): Promise<boolean> {
  if (!notificationsSupported) return false;
  return (await Notifications.getPermissionsAsync()).granted;
}

async function ensurePermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

type OneOff = { at: number; title: string; body: string };

async function apply(plan: PlannedReminder[], timerEnd: OneOff | null): Promise<void> {
  // The whole schedule is small, so replace it rather than track ids.
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (plan.length === 0 && !timerEnd) return;
  if (!(await ensurePermission())) return;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('reminders', { name: 'Reminders', importance: Notifications.AndroidImportance.DEFAULT });
  }
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

/** Make the device's scheduled notifications match the plan. Calls run one at a time. */
export function syncNotifications(plan: PlannedReminder[], timerEnd: OneOff | null): void {
  if (!notificationsSupported) return;
  queue = queue.then(() => apply(plan, timerEnd)).catch((e) => console.warn('Could not schedule notifications', e));
}
