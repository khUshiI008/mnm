import React, { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { checkAppVersion } from '../api/appVersionApi';
import { resolveFileUrl } from '../utils/fileUrl';
import UpdateRequiredScreen from '../screens/UpdateRequiredScreen';

type BlockInfo = { latestVersionName?: string; releaseNotes?: string | null; apkUrl?: string | null };

// Same AsyncStorage key AuthContext.tsx persists the signed-in user under —
// duplicated here (not read via useAuth()) because this component sits
// *above* AuthProvider in App.tsx and can't use its context.
const USER_KEY = 'apna_payroll_user';

// Mirrors client.ts's setUnauthorizedHandler pattern: a module-level callback
// the mounted gate registers, and AuthContext.signIn calls right after a
// fresh login — so a role-specific mandatory update is caught immediately
// once the true mode is known, instead of waiting for the next app resume.
let recheckHandler: (() => void) | null = null;
export function triggerAppVersionRecheck() {
  recheckHandler?.();
}

/**
 * Wraps the whole app. Renders children normally unless the backend says this
 * build is below AppVersions.MinSupportedVersionCode, in which case it shows
 * a full-screen blocking "Update Required" screen instead — regardless of
 * login state, so nobody can dodge it by staying logged out.
 *
 * Fails open on any network/check error: a flaky connection must never lock
 * everyone out, only a deliberate admin publish() does that.
 *
 * Android-only: this gate exists because Android builds are sideloaded
 * (no store to force updates). iOS ships through the App Store/TestFlight,
 * which already forces/prompts updates on its own, so this never runs there
 * — checkAppVersion() also hardcodes platform: 'android', so running it on
 * iOS would just compare against the wrong platform's row anyway.
 */
export default function AppUpdateGate({ children }: { children: React.ReactNode }) {
  if (Platform.OS !== 'android') {
    return <>{children}</>;
  }
  const [blocked, setBlocked] = useState<BlockInfo | null>(null);
  const appState = useRef(AppState.currentState);

  const runCheck = async () => {
    try {
      let mode: 'admin' | 'employee' | undefined;
      try {
        const stored = await AsyncStorage.getItem(USER_KEY);
        mode = stored ? JSON.parse(stored)?.mode : undefined;
      } catch {
        // Corrupt/unavailable storage — fall through with mode unknown (defaults to 'employee' server-side).
      }

      const res = await checkAppVersion(mode);
      const data = res.data;
      if (data.updateRequired) {
        setBlocked({ latestVersionName: data.latestVersionName, releaseNotes: data.releaseNotes, apkUrl: resolveFileUrl(data.apkUrl) });
      } else {
        setBlocked(null);
      }
    } catch {
      // Offline / backend unreachable — don't block on a check we couldn't complete.
    }
  };

  useEffect(() => {
    runCheck();
    recheckHandler = runCheck;
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && next === 'active') runCheck();
      appState.current = next;
    });
    return () => {
      sub.remove();
      recheckHandler = null;
    };
  }, []);

  if (blocked) {
    return <UpdateRequiredScreen latestVersionName={blocked.latestVersionName} releaseNotes={blocked.releaseNotes} apkUrl={blocked.apkUrl} />;
  }
  return <>{children}</>;
}
