import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TOKEN_KEY, setUnauthorizedHandler } from '../api/client';
import { AuthUser } from '../api/authApi';
import { getMyPermissions } from '../api/permissionsApi';
import { registerDeviceToken, unregisterDeviceToken } from '../notifications';
import { triggerAppVersionRecheck } from '../components/AppUpdateGate';

/** Only employee-mode users can hold manager grants — admins already have full access. */
async function withPermissions(user: AuthUser): Promise<AuthUser> {
  if (user.mode !== 'employee') return user;
  try {
    const res = await getMyPermissions();
    return { ...user, permissions: res.data.permissions };
  } catch {
    return user;
  }
}

const USER_KEY = 'apna_payroll_user';

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  signIn: (token: string, user: AuthUser) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [storedToken, storedUser] = await Promise.all([
        AsyncStorage.getItem(TOKEN_KEY),
        AsyncStorage.getItem(USER_KEY),
      ]);
      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
        withPermissions(JSON.parse(storedUser)).then(setUser);
        // Re-register on every cold start, not just fresh sign-in — a session
        // restored from AsyncStorage never otherwise calls this, so anyone
        // who was already logged in before push notifications shipped (or
        // across an app/token-rotation gap) would silently have zero active
        // DeviceToken row and never receive FCM push at all.
        registerDeviceToken().catch(() => {});
      }
      setLoading(false);
    })();
  }, []);

  const signIn = useCallback(async (newToken: string, newUser: AuthUser) => {
    await AsyncStorage.setItem(TOKEN_KEY, newToken);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
    registerDeviceToken().catch(() => {});
    withPermissions(newUser).then(setUser);
    // Mode is only just now known (was 'unknown' pre-login, defaulting the
    // update-gate check to the 'employee' track) — recheck immediately so a
    // role-specific mandatory update is caught right at login instead of
    // waiting for the next app resume.
    triggerAppVersionRecheck();
  }, []);

  const signOut = useCallback(async () => {
    await unregisterDeviceToken();
    await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
    setToken(null);
    setUser(null);
  }, []);

  // A background 401 (session expired, or invalidated by another device
  // signing in — see middleware/auth.js) drives the same sign-out path a
  // manual logout does, so the app falls back to the Login screen instead of
  // silently failing every subsequent request.
  useEffect(() => {
    setUnauthorizedHandler(signOut);
    return () => setUnauthorizedHandler(null);
  }, [signOut]);

  return (
    <AuthContext.Provider value={{ user, token, loading, signIn, signOut }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
