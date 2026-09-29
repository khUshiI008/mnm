import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Icon from './Icon';
import { colors } from '../theme';
import { useNotifications } from '../context/NotificationContext';
import NotificationsModal from './NotificationsModal';

/** Shared by both AdminTopbar and every employee tab's header — backend scopes the list by JWT identity, so one bell works everywhere. */
export default function NotificationBell({ color = colors.text }: { color?: string }) {
  const { unreadCount } = useNotifications();
  const [visible, setVisible] = useState(false);

  return (
    <>
      <Pressable style={styles.btn} onPress={() => setVisible(true)} hitSlop={8}>
        <Icon name="bell" size={20} color={color} />
        {unreadCount > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
          </View>
        ) : null}
      </Pressable>
      <NotificationsModal visible={visible} onClose={() => setVisible(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  btn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
});
