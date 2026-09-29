import AsyncStorage from '@react-native-async-storage/async-storage';

const DEVICE_ID_KEY = 'apna_payroll_device_id';
let cached: string | null = null;

/**
 * Random per-install identifier, generated once and persisted — not tied to
 * the FCM push token (which can rotate) or to login (an admin can be signed
 * into several devices at once under the same login). Sent as the
 * X-Device-Id header on every request; the backend uses it to keep admin
 * notification read/cleared state separate per device (see
 * notificationController.js's getDeviceId / AdminNotificationDeviceState).
 */
function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function getDeviceId(): Promise<string> {
  if (cached) return cached;
  let id = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = generateId();
    await AsyncStorage.setItem(DEVICE_ID_KEY, id);
  }
  cached = id;
  return id;
}
