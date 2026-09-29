import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Icon, { IconName } from '../../components/Icon';
import { colors, radius, shadow, spacing } from '../../theme';
import { useAdminNav } from '../../navigation/AdminShell';
import { SIDEBAR_GROUPS, SidebarGroup } from '../../components/admin/AdminSidebar';
import { getEmailInboxUnreadCount } from '../../api/emailInboxApi';

const A = colors.admin;

// One accent color per module so the menu reads as colorful/scannable rather
// than a flat list — reuses each group's existing sidebar icon, just adds color.
const MODULE_COLORS: Record<string, string> = {
  dashboard: A.primary,
  salesDashboard: '#14b8a6',
  grpPayroll: '#0ea5e9',
  grpAttendance: '#10b981',
  grpLeave: '#f97316',
  grpLoan: '#8b5cf6',
  grpSalary: '#eab308',
  grpMIS: '#ec4899',
  grpSales: '#14b8a6',
  grpTarget: '#dc2626',
  grpScanner: '#0891b2',
  emailInbox: '#f43f5e',
};

// The Home tab's curated module list + order — a subset of the sidebar's full
// group list (Company/Employee/Order are setup-heavy and left off this
// quick-access menu on purpose; they're still reachable from the sidebar).
const HOME_GROUP_ORDER = ['grpPayroll', 'grpAttendance', 'grpLeave', 'grpLoan', 'grpSalary', 'grpMIS', 'grpSales', 'grpTarget', 'grpScanner'];

function findGroup(id: string): SidebarGroup | undefined {
  return SIDEBAR_GROUPS.find((g) => g.id === id);
}

function MenuRow({
  icon,
  color,
  label,
  onPress,
  badgeCount,
}: {
  icon: IconName;
  color: string;
  label: string;
  onPress: () => void;
  badgeCount?: number | null;
}) {
  return (
    <Pressable style={({ pressed }) => [styles.row, pressed && styles.rowPressed]} onPress={onPress}>
      <View style={[styles.iconBadge, { backgroundColor: color + '1f' }]}>
        <Icon name={icon} size={20} color={color} />
        {!!badgeCount && (
          <View style={styles.rowBadge}>
            <Text style={styles.rowBadgeText}>{badgeCount > 99 ? '99+' : badgeCount}</Text>
          </View>
        )}
      </View>
      <Text style={styles.rowLabel}>{label}</Text>
      <Icon name="chevronRight" size={18} color={A.muted} />
    </Pressable>
  );
}

export default function ModuleMenuScreen({ params }: { params?: { groupId?: string } }) {
  // navigate() PUSHES onto the nav stack (keeps this menu underneath, so the
  // hardware/topbar back button has somewhere to go). resetTo() REPLACES the
  // whole stack instead — right for bottom-nav/sidebar "fresh jump" taps, but
  // using it here left nothing on the stack to go back to, so back fell
  // through to the OS default and closed the app instead of returning here.
  const { navigate } = useAdminNav();
  const [unreadImportantEmails, setUnreadImportantEmails] = useState<number | null>(null);

  useEffect(() => {
    getEmailInboxUnreadCount()
      .then((res) => setUnreadImportantEmails(res.data.unreadImportantCount))
      .catch(() => {});
  }, []);

  // Drilled into one module's submodules (e.g. tapped "Salary").
  if (params?.groupId) {
    const group = findGroup(params.groupId);
    const color = MODULE_COLORS[params.groupId] || A.primary;
    return (
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {!group || group.links.length === 0 ? (
          <Text style={styles.emptyText}>Nothing here yet.</Text>
        ) : (
          group.links.map((link) => (
            <MenuRow key={link.key} icon={group.icon} color={color} label={link.label} onPress={() => navigate(link.key)} />
          ))
        )}
      </ScrollView>
    );
  }

  // Top-level module list.
  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.heading}>Modules</Text>
      <Text style={styles.subheading}>Jump straight to any part of the panel</Text>

      <MenuRow icon="grid" color={MODULE_COLORS.dashboard} label="Attendance Dashboard" onPress={() => navigate('AdminDashboard')} />
      <MenuRow icon="barTrend" color={MODULE_COLORS.salesDashboard} label="Sales Dashboard" onPress={() => navigate('SalesReportsHub')} />
      <MenuRow icon="bell" color={MODULE_COLORS.emailInbox} label="Email Inbox" onPress={() => navigate('EmailInbox')} badgeCount={unreadImportantEmails} />

      {HOME_GROUP_ORDER.map((id) => {
        const group = findGroup(id);
        if (!group) return null;
        const color = MODULE_COLORS[id] || A.primary;
        const single = group.links.length === 1;
        return (
          <MenuRow
            key={id}
            icon={group.icon}
            color={color}
            label={group.label}
            onPress={
              single ? () => navigate(group.links[0].key) : () => navigate('HomeMenu', { groupId: id, title: group.label })
            }
          />
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing(2), paddingBottom: spacing(4) },
  heading: { fontSize: 22, fontWeight: '800', color: A.ink, marginBottom: 2 },
  subheading: { fontSize: 13, color: A.muted, marginBottom: spacing(2), fontWeight: '500' },
  emptyText: { fontSize: 13, color: A.muted, textAlign: 'center', marginTop: spacing(4) },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: A.surface,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 10,
    ...shadow.card,
  },
  rowPressed: { opacity: 0.85 },
  iconBadge: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { flex: 1, fontSize: 18, fontWeight: '800', color: A.ink },
  rowBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 3,
    borderRadius: 9,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: A.surface,
  },
  rowBadgeText: { fontSize: 9.5, fontWeight: '800', color: '#fff' },
});
