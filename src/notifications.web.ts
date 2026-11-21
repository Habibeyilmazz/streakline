import type * as Native from './notifications';

// A browser tab cannot schedule local notifications. This stub keeps
// expo-notifications, and the warning it logs on import, out of the web build.
export const notificationsSupported = false;
export const notificationsAllowed: typeof Native.notificationsAllowed = async () => false;
export const onNotificationsSynced: typeof Native.onNotificationsSynced = () => () => {};
export const syncNotifications: typeof Native.syncNotifications = () => {};
