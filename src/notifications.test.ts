import * as Notifications from 'expo-notifications';

import { notificationsAllowed, onNotificationsSynced, syncNotifications } from './notifications';

// The native module cannot run under jest, so this checks the calls made to it.
jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));
jest.mock('expo-notifications', () => ({
  SchedulableTriggerInputTypes: { DAILY: 'daily', WEEKLY: 'weekly', DATE: 'date' },
  AndroidImportance: { DEFAULT: 3 },
  setNotificationHandler: jest.fn(),
  cancelAllScheduledNotificationsAsync: jest.fn(async () => {}),
  setNotificationChannelAsync: jest.fn(async () => null),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(async () => 'id'),
}));

const N = jest.mocked(Notifications);
let granted = false;
let canAskAgain = true;
const calls: string[] = [];

beforeEach(() => {
  jest.clearAllMocks();
  granted = false;
  canAskAgain = true;
  calls.length = 0;
  const status = async () => ({ granted, canAskAgain }) as Notifications.NotificationPermissionsStatus;
  N.getPermissionsAsync.mockImplementation(status);
  N.requestPermissionsAsync.mockImplementation(async () => {
    calls.push('ask');
    granted = true; // the user taps Allow
    return status();
  });
  N.setNotificationChannelAsync.mockImplementation(async () => (calls.push('channel'), null));
  N.scheduleNotificationAsync.mockImplementation(async () => (calls.push('schedule'), 'id'));
});

const synced = () =>
  new Promise<void>((done) => {
    const off = onNotificationsSynced(() => {
      off();
      done();
    });
  });
const daily = { title: 'Read', body: 'Time to check in.', hour: 7, minute: 30 };
const triggers = () => N.scheduleNotificationAsync.mock.calls.map(([request]) => request.trigger);

test('with nothing to schedule it clears the old schedule and never asks for permission', async () => {
  syncNotifications([], null, true);
  await synced();
  expect(N.cancelAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);
  expect(calls).toEqual([]);
});

test('the first reminder creates the channel, then asks, then schedules', async () => {
  syncNotifications([daily, { ...daily, weekday: 0 }, { ...daily, weekday: 6 }], null, true);
  await synced();
  expect(calls).toEqual(['channel', 'ask', 'schedule', 'schedule', 'schedule']);
  expect(triggers()).toEqual([
    { type: 'daily', hour: 7, minute: 30, channelId: 'reminders' },
    // The app counts weekdays from 0 = Sunday, Expo from 1 = Sunday.
    { type: 'weekly', weekday: 1, hour: 7, minute: 30, channelId: 'reminders' },
    { type: 'weekly', weekday: 7, hour: 7, minute: 30, channelId: 'reminders' },
  ]);
});

test('listeners run after the permission prompt is answered, not before', async () => {
  expect(await notificationsAllowed()).toBe(false);
  let seen: boolean | null = null;
  const off = onNotificationsSynced(() => void notificationsAllowed().then((v) => (seen = v)));
  syncNotifications([daily], null, true);
  await synced();
  await Promise.resolve();
  off();
  expect(seen).toBe(true);
});

test('a background refresh never prompts, and schedules nothing without permission', async () => {
  syncNotifications([daily], null, false);
  await synced();
  expect(calls).toEqual(['channel']);
});

test('a permission the user refused for good is not asked for again', async () => {
  canAskAgain = false;
  syncNotifications([daily], null, true);
  await synced();
  expect(calls).toEqual(['channel']);
});

test('the timer end is scheduled only while it is still in the future', async () => {
  granted = true;
  const at = Date.now() + 60_000;
  syncNotifications([], { at, title: 'Focus session done', body: 'Time is up.' }, true);
  await synced();
  syncNotifications([], { at: Date.now() - 1, title: 'Focus session done', body: 'Time is up.' }, true);
  await synced();
  expect(triggers()).toEqual([{ type: 'date', date: at, channelId: 'reminders' }]);
});

test('a failed sync is reported and does not block the next one', async () => {
  granted = true;
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  N.cancelAllScheduledNotificationsAsync.mockRejectedValueOnce(new Error('native module unavailable'));
  syncNotifications([daily], null, true);
  await synced();
  expect(warn).toHaveBeenCalledTimes(1);
  expect(calls).toEqual([]);
  syncNotifications([daily], null, true);
  await synced();
  expect(calls).toEqual(['channel', 'schedule']);
  warn.mockRestore();
});
