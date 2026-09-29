import { Platform, PermissionsAndroid } from 'react-native';
import messaging, { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import notifee, { AndroidImportance } from '@notifee/react-native';
import { registerDeviceToken as postDeviceToken, unregisterDeviceToken as deleteDeviceToken } from '../api/notificationsApi';
import {
  DEFAULT_CHANNEL_ID,
  TARGET_COMPLETION_CHANNEL_ID,
  BIRTHDAY_CHANNEL_ID,
  ANNIVERSARY_CHANNEL_ID,
  TARGET_REMARKS_CHANNEL_ID,
  IMPORTANT_EMAIL_CHANNEL_ID,
} from './channels';

const KNOWN_CHANNEL_IDS = new Set([
  TARGET_COMPLETION_CHANNEL_ID,
  BIRTHDAY_CHANNEL_ID,
  ANNIVERSARY_CHANNEL_ID,
  TARGET_REMARKS_CHANNEL_ID,
  IMPORTANT_EMAIL_CHANNEL_ID,
]);

/** Android 13+ requires a runtime permission for notifications; below that (and for the Firebase-side iOS check) messaging().requestPermission() covers it. */
export async function requestNotificationPermission() {
  if (Platform.OS === 'android' && Platform.Version >= 33) {
    await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  }
  await messaging().requestPermission();
}

/** Fetches the current FCM token and registers it with the backend; re-registers automatically if Firebase rotates it. */
export async function registerDeviceToken() {
  try {
    const token = await messaging().getToken();
    if (token) await postDeviceToken(token, Platform.OS);
  } catch (err) {
    console.warn('[notifications] registerDeviceToken failed', err);
  }

  return messaging().onTokenRefresh((token) => {
    postDeviceToken(token, Platform.OS).catch(() => {});
  });
}

/** Best-effort — called right before AuthContext clears the session on sign-out. */
export async function unregisterDeviceToken() {
  try {
    const token = await messaging().getToken();
    if (token) await deleteDeviceToken(token);
  } catch {
    /* best-effort */
  }
}

function channelIdFor(remoteMessage: FirebaseMessagingTypes.RemoteMessage): string {
  const requested = remoteMessage.data?.channelId as string | undefined;
  return requested && KNOWN_CHANNEL_IDS.has(requested) ? requested : DEFAULT_CHANNEL_ID;
}

async function displayLocalNotification(remoteMessage: FirebaseMessagingTypes.RemoteMessage) {
  const title = remoteMessage.notification?.title || (remoteMessage.data?.title as string) || 'Apna Payroll';
  const body = remoteMessage.notification?.body || (remoteMessage.data?.body as string) || '';
  const channelId = channelIdFor(remoteMessage);

  await notifee.displayNotification({
    title,
    body,
    android: { channelId, importance: AndroidImportance.HIGH, pressAction: { id: 'default' } },
  });
}

/**
 * RNFirebase does NOT auto-display a notification while the app is
 * foregrounded (only backgrounded/killed gets the OS tray automatically) —
 * this fills that gap via Notifee, and also lets `onNotification` bump the
 * in-app badge/list immediately instead of waiting for the next poll.
 */
export function registerForegroundHandler(onNotification: () => void) {
  return messaging().onMessage(async (remoteMessage) => {
    await displayLocalNotification(remoteMessage);
    onNotification();
  });
}

/**
 * Purely local — not tied to any FCM push. Called by NotificationContext
 * every time the app comes to the foreground on the employee's birthday
 * (see isBirthdayToday from GET /notifications), so it deliberately fires
 * every open rather than being deduped like the other notification types.
 */
export async function displayBirthdayNotification(title: string, body: string) {
  await notifee.displayNotification({
    title,
    body,
    android: { channelId: BIRTHDAY_CHANNEL_ID, importance: AndroidImportance.HIGH, pressAction: { id: 'default' } },
  });
}

/**
 * Purely local — not tied to any FCM push. Called by NotificationContext
 * when the app comes to the foreground on the employee's anniversary (see
 * isAnniversaryToday from GET /notifications), throttled there so it
 * doesn't replay on every single app open.
 */
export async function displayAnniversaryNotification(title: string, body: string) {
  await notifee.displayNotification({
    title,
    body,
    android: { channelId: ANNIVERSARY_CHANNEL_ID, importance: AndroidImportance.HIGH, pressAction: { id: 'default' } },
  });
}

/**
 * Must be called from index.js, outside the React tree, before
 * AppRegistry.registerComponent — this is how RNFirebase requires
 * background/killed-state message handling to be wired.
 *
 * Deliberately a no-op body: every push this backend sends includes a
 * `notification` payload (see notificationService.js's sendPush), so Android
 * already auto-displays it from the system tray the moment it arrives while
 * the app is backgrounded/killed — before this handler even runs. Calling
 * displayLocalNotification() here too used to draw a SECOND notification for
 * the same message, and by the time this handler fires Android has already
 * consumed/emptied `remoteMessage.notification`, so that second one rendered
 * with blank title/body (falling back to just the app name). Registration
 * still has to exist for RNFirebase's background delivery contract to work
 * at all — it just doesn't need to do anything. Foreground delivery is
 * unaffected: RNFirebase never auto-displays while the app is open, so
 * registerForegroundHandler below still needs its own explicit
 * displayLocalNotification call.
 */
export function setBackgroundMessageHandler() {
  messaging().setBackgroundMessageHandler(async () => {});
}
