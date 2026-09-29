import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '../Icon';
import NotificationBell from '../NotificationBell';
import { colors } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { confirmSignOut } from '../../utils/confirmSignOut';

const A = colors.admin;

/**
 * Mirrors Panel/Dashboard.Master's <header class="hrms-topbar"> in its
 * mobile-collapsed form (search box, subtitle, and user name/role text are
 * all hidden ≤960px per Content/dashboard.css — RN is always that width, so
 * this only ever needs to render the mobile variant): hamburger/back, title,
 * notification bell (live unread badge + tap-to-open list, backed by
 * NotificationContext), avatar, logout.
 */
export default function AdminTopbar({
  title,
  onMenuPress,
  onBackPress,
}: {
  title: string;
  onMenuPress: () => void;
  onBackPress?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const initial = (user?.name || 'A').charAt(0).toUpperCase();

  return (
    <View style={[styles.bar, { paddingTop: insets.top + 10 }]}>
      {onBackPress ? (
        <Pressable style={styles.iconBtn} onPress={onBackPress}>
          <Icon name="chevronLeft" size={22} color={A.ink} />
        </Pressable>
      ) : null}

      <Pressable style={styles.iconBtn} onPress={onMenuPress}>
        <Icon name="hamburger" size={22} color={A.ink} />
      </Pressable>

      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>

      <NotificationBell color={A.ink} />

      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initial}</Text>
      </View>

      <Pressable style={styles.iconBtn} onPress={() => confirmSignOut(signOut)}>
        <Icon name="logOut" size={18} color={A.ink} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingBottom: 10,
    gap: 6,
    backgroundColor: A.surface,
    borderBottomWidth: 1,
    borderBottomColor: A.border,
  },
  iconBtn: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: 16, fontWeight: '800', color: A.ink },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: A.primary, alignItems: 'center', justifyContent: 'center', marginLeft: 4 },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
