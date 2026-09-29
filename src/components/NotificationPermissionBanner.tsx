import React, { useCallback, useEffect, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text } from 'react-native';
import notifee, { AuthorizationStatus } from '@notifee/react-native';
import { spacing } from '../theme';

/**
 * Android never re-shows the one-time POST_NOTIFICATIONS system prompt once denied — an
 * employee who reflexively tapped "Don't allow" on first launch (before understanding why
 * an HR app wants it) is then silently locked out of every push (target achieved, leave
 * approvals, etc.) with no signal anything's wrong. This is the only way back short of the
 * employee digging into OS Settings on their own, so it re-checks on every foreground and
 * clears itself the moment permission is granted again.
 */
export default function NotificationPermissionBanner() {
  const [blocked, setBlocked] = useState(false);

  const check = useCallback(async () => {
    const settings = await notifee.getNotificationSettings();
    setBlocked(settings.authorizationStatus === AuthorizationStatus.DENIED);
  }, []);

  useEffect(() => {
    check();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => sub.remove();
  }, [check]);

  if (!blocked) return null;

  return (
    <Pressable onPress={() => notifee.openNotificationSettings()} style={styles.banner}>
      <Text style={styles.title}>Notifications are turned off</Text>
      <Text style={styles.text}>You won't get alerts for target achievements, leave updates or approvals. Tap here to enable.</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    padding: spacing(2),
    marginBottom: spacing(2),
  },
  title: { fontSize: 14, fontWeight: '700', color: '#b91c1c' },
  text: { fontSize: 12, color: '#b91c1c', marginTop: 2 },
});
