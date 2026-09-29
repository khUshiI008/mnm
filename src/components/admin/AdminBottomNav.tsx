import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon, { IconName } from '../Icon';
import { colors } from '../../theme';
import { useAdminNav } from '../../navigation/AdminShell';
import { getPendingLeaveFlag } from '../../api/adminShellApi';

const A = colors.admin;

type NavItem = { key: string; label: string; icon: IconName; badge?: boolean };

// Based on Panel/Dashboard.Master's <nav class="hrms-bottomnav">, plus a leading
// 'Dashboard' tab (mobile-only) that opens the attendance KPI dashboard directly.
// 'Home' opens the module-menu screen (ModuleMenuScreen).
const ITEMS: NavItem[] = [
  { key: 'AdminDashboard', label: 'Dashboard', icon: 'grid' },
  { key: 'HomeMenu', label: 'Home', icon: 'home' },
  { key: 'EmployeeRegistrations', label: 'Register', icon: 'personCheck' },
  { key: 'LeaveApproval', label: 'Leave', icon: 'calendarCheck', badge: true },
  { key: 'SalaryAdvance', label: 'Advance', icon: 'creditCardDot' },
  { key: 'LoanDashboard', label: 'Loan', icon: 'dollar' },
];

export default function AdminBottomNav({ activeKey }: { activeKey: string }) {
  const insets = useSafeAreaInsets();
  const { resetTo } = useAdminNav();
  const [hasPendingLeave, setHasPendingLeave] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getPendingLeaveFlag()
      .then((res) => {
        if (!cancelled) setHasPendingLeave(res.data.hasPendingLeaveApprovals);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [activeKey]);

  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom + 6 }]}>
      {ITEMS.map((item) => {
        const active = item.key === activeKey;
        const color = active ? A.primary : A.muted;
        return (
          <Pressable key={item.key} style={styles.item} onPress={() => resetTo(item.key)}>
            <View>
              <Icon name={item.icon} size={24} color={color} strokeWidth={active ? 2.6 : 2.2} />
              {item.badge && hasPendingLeave ? <View style={styles.badge} /> : null}
            </View>
            <Text style={[styles.label, { color }]} numberOfLines={1}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: A.surface,
    borderTopWidth: 1,
    borderTopColor: A.border,
    paddingTop: 10,
  },
  item: { flex: 1, alignItems: 'center', gap: 4 },
  label: { fontSize: 10, fontWeight: '700' },
  badge: { position: 'absolute', top: -3, right: -5, width: 9, height: 9, borderRadius: 4.5, backgroundColor: '#e11d48' },
});
