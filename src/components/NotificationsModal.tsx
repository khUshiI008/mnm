import React from 'react';
import { Alert, FlatList, Modal, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from './Icon';
import { colors, radius, spacing } from '../theme';
import { useNotifications } from '../context/NotificationContext';
import { AppNotification } from '../api/notificationsApi';
import { useAuth } from '../context/AuthContext';
import { handleAdminNotificationTap } from '../notifications/adminNotificationRouter';
import { handleEmployeeNotificationTap } from '../notifications/employeeNotificationRouter';

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function typeIcon(type: string): { name: 'calendar' | 'barTrend' | 'bell'; color: string } {
  if (type === 'LeaveApplied') return { name: 'calendar', color: colors.warning };
  if (type === 'TargetCompleted') return { name: 'barTrend', color: colors.success };
  return { name: 'bell', color: colors.primary };
}

function ItemSeparator() {
  return <View style={styles.separator} />;
}

// Admin-only tab split — the employee side keeps the old flat list (its own
// notification types are mostly personal decisions, not worth splitting).
// "Greeting" = celebratory broadcasts; "Email" = the Email Inbox feature;
// everything else (leave/registration/target/loan/... work items) is
// "General". Any type not listed here — including future ones — falls
// through to General rather than silently vanishing from every tab.
const GREETING_TYPES = new Set(['Birthday', 'Anniversary', 'FestivalGreeting', 'GurpurabGreeting']);
const EMAIL_TYPES = new Set(['ImportantEmail']);

type NotifTab = 'general' | 'greeting' | 'email';

function notifTab(type: string): NotifTab {
  if (EMAIL_TYPES.has(type)) return 'email';
  if (GREETING_TYPES.has(type)) return 'greeting';
  return 'general';
}

const TAB_DEFS: { key: NotifTab; label: string }[] = [
  { key: 'general', label: 'General' },
  { key: 'greeting', label: 'Greetings' },
  { key: 'email', label: 'Emails' },
];

type Props = { visible: boolean; onClose: () => void };

export default function NotificationsModal({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { notifications, unreadCount, refresh, markRead, markAllRead, clearAll } = useNotifications();
  const [refreshing, setRefreshing] = React.useState(false);
  const isAdmin = user?.mode === 'admin';
  const [activeTab, setActiveTab] = React.useState<NotifTab>('general');

  const visibleNotifications = isAdmin ? notifications.filter((n) => notifTab(n.type) === activeTab) : notifications;
  const tabCounts = React.useMemo(() => {
    const counts: Record<NotifTab, number> = { general: 0, greeting: 0, email: 0 };
    notifications.forEach((n) => {
      if (!n.isRead) counts[notifTab(n.type)] += 1;
    });
    return counts;
  }, [notifications]);

  // Tapping a notification navigates to (or opens the popup for) whatever
  // it's about, for both admin and employee — see adminNotificationRouter.ts
  // / employeeNotificationRouter.ts for the per-type mapping.
  const handleRowPress = (item: AppNotification) => {
    if (!item.isRead) markRead(item.notificationId);
    if (user?.mode === 'admin') {
      onClose();
      handleAdminNotificationTap(item);
    } else if (user?.mode === 'employee') {
      onClose();
      handleEmployeeNotificationTap(item);
    }
  };

  React.useEffect(() => {
    if (visible) refresh();
  }, [visible, refresh]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const onClearAll = () => {
    Alert.alert('Clear all notifications?', 'This removes every notification and cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear all', style: 'destructive', onPress: clearAll },
    ]);
  };

  const renderItem = ({ item }: { item: AppNotification }) => {
    const icon = typeIcon(item.type);
    return (
      <Pressable style={styles.row} onPress={() => handleRowPress(item)}>
        <View style={[styles.iconWrap, { backgroundColor: icon.color + '1a' }]}>
          <Icon name={icon.name} size={18} color={icon.color} />
        </View>
        <View style={styles.rowBody}>
          <Text style={styles.rowTitle}>{item.title}</Text>
          <Text style={styles.rowMessage}>{item.body}</Text>
          <Text style={styles.rowTime}>{timeAgo(item.createdDate)}</Text>
        </View>
        {!item.isRead ? <View style={styles.unreadDot} /> : null}
      </Pressable>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        {/* Backdrop is a plain sibling positioned behind the sheet, not an
            ancestor of it — a Pressable ancestor around the scrollable list
            below intermittently steals touch-move events meant for its
            scroll gesture (worked most taps, randomly ate others). Same fix
            as SalesReportDetailScreen.tsx / EmailInboxScreen.tsx. */}
        <Pressable style={[StyleSheet.absoluteFill, styles.backdropFill]} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Notifications</Text>
            <View style={styles.headerActions}>
              {unreadCount > 0 ? (
                <Pressable onPress={markAllRead} hitSlop={8}>
                  <Text style={styles.markAllText}>Mark all read</Text>
                </Pressable>
              ) : null}
              {notifications.length > 0 ? (
                <Pressable onPress={onClearAll} hitSlop={8}>
                  <Text style={styles.clearAllText}>Clear all</Text>
                </Pressable>
              ) : null}
              <Pressable onPress={onClose} hitSlop={8} style={styles.closeBtn}>
                <Icon name="x" size={18} color={colors.textMuted} />
              </Pressable>
            </View>
          </View>

          {isAdmin && (
            <View style={styles.tabBar}>
              {TAB_DEFS.map((t) => {
                const active = activeTab === t.key;
                const count = tabCounts[t.key];
                return (
                  <Pressable key={t.key} style={[styles.tabBtn, active && styles.tabBtnActive]} onPress={() => setActiveTab(t.key)}>
                    <Text style={[styles.tabBtnText, active && styles.tabBtnTextActive]}>{t.label}</Text>
                    {count > 0 && (
                      <View style={[styles.tabBadge, active && styles.tabBadgeActive]}>
                        <Text style={[styles.tabBadgeText, active && styles.tabBadgeTextActive]}>{count > 99 ? '99+' : count}</Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          )}

          <FlatList
            data={visibleNotifications}
            keyExtractor={(item) => String(item.notificationId)}
            renderItem={renderItem}
            style={styles.list}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            ItemSeparatorComponent={ItemSeparator}
            showsVerticalScrollIndicator
            nestedScrollEnabled
            initialNumToRender={20}
            maxToRenderPerBatch={20}
            windowSize={7}
            removeClippedSubviews
            ListEmptyComponent={
              <View style={styles.empty}>
                <Icon name="bell" size={28} color={colors.textMuted} />
                <Text style={styles.emptyText}>You're all caught up</Text>
              </View>
            }
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdropFill: { backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, maxHeight: '80%', flexShrink: 1, overflow: 'hidden', paddingTop: 8 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing(2),
    paddingVertical: spacing(1.5),
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  markAllText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  clearAllText: { color: colors.danger, fontWeight: '700', fontSize: 13 },
  closeBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  tabBar: { flexDirection: 'row', gap: 8, paddingHorizontal: spacing(2), paddingTop: spacing(1.5) },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabBtnText: { fontSize: 12.5, fontWeight: '700', color: colors.textMuted },
  tabBtnTextActive: { color: '#fff' },
  tabBadge: { minWidth: 16, height: 16, paddingHorizontal: 3, borderRadius: 8, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  tabBadgeActive: { backgroundColor: 'rgba(255,255,255,0.3)' },
  tabBadgeText: { fontSize: 9.5, fontWeight: '800', color: '#fff' },
  tabBadgeTextActive: { color: '#fff' },
  list: { paddingHorizontal: spacing(1), flexGrow: 0, flexShrink: 1 },
  row: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: spacing(1.5), paddingHorizontal: spacing(1), gap: 10 },
  iconWrap: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  rowBody: { flex: 1 },
  rowTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  rowMessage: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  rowTime: { fontSize: 11, color: colors.textMuted, marginTop: 4 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginTop: 6 },
  separator: { height: 1, backgroundColor: colors.border, marginLeft: spacing(1) + 46 },
  empty: { alignItems: 'center', paddingVertical: spacing(6), gap: 8 },
  emptyText: { color: colors.textMuted, fontSize: 13 },
});
