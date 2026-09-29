import client from './client';
import { APP_VERSION_CODE } from '../config';

export type AppVersionCheck = {
  success: boolean;
  updateRequired: boolean;
  updateAvailable: boolean;
  latestVersionCode?: number;
  latestVersionName?: string;
  minSupportedVersionCode?: number;
  apkUrl?: string | null;
  releaseNotes?: string | null;
};

// Backend route is public (no auth) — must work even when logged out or the token has expired.
// `mode` is the device's last-known login mode ('admin' | 'employee') — the
// gate tracks each independently server-side so an admin-only release
// doesn't force-block employee phones and vice versa. Omit when unknown
// (logged out / fresh install); the backend defaults to 'employee'.
export const checkAppVersion = (mode?: 'admin' | 'employee') =>
  client.get<AppVersionCheck>('/app-version', { params: { platform: 'android', versionCode: APP_VERSION_CODE, audience: mode } });
