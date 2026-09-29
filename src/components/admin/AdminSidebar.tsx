import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon, { IconName } from '../Icon';
import { colors } from '../../theme';
import { useAdminNav } from '../../navigation/AdminShell';
import { useAuth } from '../../context/AuthContext';

const A = colors.admin;

export type SidebarLink = { key: string; label: string };
export type SidebarGroup = { id: string; label: string; icon: IconName; links: SidebarLink[] };

// Matches Panel/Dashboard.Master's sidebar — exact group order/labels/icons.
// Only groups with a built (or soon-to-be-built) module are expanded by
// default; the rest still navigate to ComingSoonScreen so the full .NET
// module set is browsable even before every page is ported.
// Exported so ModuleMenuScreen (the Home tab's module list) reuses the exact
// same group/link/icon data instead of maintaining a second, driftable copy.
export const SIDEBAR_GROUPS: SidebarGroup[] = [
  {
    id: 'grpCompany',
    label: 'Company',
    icon: 'building',
    links: [
      { key: 'Organization', label: 'Organizations' },
      { key: 'Locations', label: 'Locations' },
      { key: 'EmployeeMasters', label: 'Employee Masters' },
      { key: 'Permissions', label: 'Permissions' },
    ],
  },
  {
    id: 'grpEmployee',
    label: 'Employee',
    icon: 'twoUsers',
    links: [
      { key: 'Employees', label: 'Employees' },
      { key: 'EmployeesImport', label: 'Import Employees' },
      { key: 'EmployeeRegistrations', label: 'Registrations' },
      { key: 'Shifts', label: 'Shifts' },
      { key: 'ShiftHierarchy', label: 'Shift Hierarchy' },
    ],
  },
  {
    id: 'grpOrder',
    label: 'Order',
    icon: 'box',
    links: [
      { key: 'Orders', label: 'Order File Upload' },
      { key: 'PTUpload', label: 'Upload PT File' },
    ],
  },
  {
    id: 'grpAttendance',
    label: 'Attendance',
    icon: 'calendarCheck',
    // Attendance Policy, Import Punch, and the plain (non-biometric) Report/
    // Partial pair are hidden for now (deliberately still registered in
    // AdminShell's ADMIN_SCREENS — just not reachable from either nav surface
    // that reads this array, sidebar drawer and the Home tab grid alike).
    links: [
      { key: 'BiometricReport', label: 'Attendance Report' },
      { key: 'BiometricPartial', label: 'Missed Punches' },
    ],
  },
  {
    id: 'grpLeave',
    label: 'Leave',
    icon: 'calendar',
    links: [
      { key: 'LeaveApplicationAdmin', label: 'Leave Application' },
      { key: 'LeaveApproval', label: 'Leave Approval' },
      { key: 'LeaveAdmin', label: 'Leave Admin' },
      { key: 'LeaveTypes', label: 'Leave Types' },
      { key: 'LeavePolicies', label: 'Leave Policies' },
    ],
  },
  {
    id: 'grpLoan',
    label: 'Loan',
    icon: 'briefcase',
    links: [
      { key: 'StaffLoans', label: 'Staff Brand Loans' },
      { key: 'PayrollLoans', label: 'Staff Loans' },
      { key: 'LoanDashboard', label: 'Loan Dashboard' },
      { key: 'SalaryAdvancePolicies', label: 'Advance Policy' },
      { key: 'MonthlyRecoveries', label: 'Monthly Recoveries' },
    ],
  },
  {
    id: 'grpSalary',
    label: 'Salary',
    icon: 'dollar',
    links: [
      { key: 'SalaryRevisions', label: 'Salary Revisions' },
      { key: 'SalaryHeads', label: 'Salary Heads' },
      { key: 'SalaryAdvance', label: 'Salary Advance' },
    ],
  },
  {
    id: 'grpPayroll',
    label: 'Payroll',
    icon: 'cashRegister',
    links: [{ key: 'Payroll', label: 'Payroll' }],
  },
  {
    id: 'grpMIS',
    label: 'MIS Reporting',
    icon: 'barTrend',
    links: [{ key: 'PerformanceReport', label: 'Staff Performance Report' }],
  },
  {
    id: 'grpSales',
    label: 'Sales',
    icon: 'barTrend',
    links: [
      { key: 'SalesDashboard', label: 'Sales KPIs' },
      { key: 'SalesReportsHub', label: 'Sales Dashboard' },
      { key: 'SalesMasterData', label: 'Master Data' },
      { key: 'SalesReport', label: 'Sales Report' },
    ],
  },
  {
    id: 'grpTarget',
    label: 'Target',
    icon: 'trendingUp',
    links: [
      { key: 'TargetGenerate', label: 'Target Generate' },
      { key: 'TargetAnalysis', label: 'Target Analysis' },
    ],
  },
  {
    // Every admin — who may log in to the separate aScanner app (mobile + OTP).
    id: 'grpScanner',
    label: 'Scanner App',
    icon: 'phone',
    links: [{ key: 'ScannerAccess', label: 'Scanner App Access' }],
  },
  {
    // Restricted to the one special admin (user.isSpecialAdmin) — filtered out
    // in the render below for everyone else, so it's excluded from the drawer
    // list entirely rather than shown-but-blocked.
    id: 'grpSettings',
    label: 'Settings',
    icon: 'gear',
    links: [{ key: 'MorningQuotes', label: 'Quotes' }],
  },
];

export default function AdminSidebar({ visible, onClose, activeKey }: { visible: boolean; onClose: () => void; activeKey: string }) {
  const insets = useSafeAreaInsets();
  const { resetTo } = useAdminNav();
  const { user } = useAuth();
  const visibleGroups = useMemo(
    () => (user?.isSpecialAdmin ? SIDEBAR_GROUPS : SIDEBAR_GROUPS.filter((g) => g.id !== 'grpSettings')),
    [user?.isSpecialAdmin]
  );
  // Recomputed on every layout change (fold/unfold, rotation) instead of once at
  // module load — a stale width from before a Z Fold unfold left sub-item rows
  // narrower than the drawer actually rendered, which combined with the missing
  // flex/shrink below to hard-clip labels to their first word.
  const { width: windowWidth } = useWindowDimensions();
  const DRAWER_WIDTH = Math.min(300, windowWidth * 0.82);
  // translateX's initial value intentionally ignores `visible` — this component is
  // always mounted (see below), so it always starts closed regardless of the prop.
  const translateX = useRef(new Animated.Value(-DRAWER_WIDTH)).current;

  const activeGroupId = useMemo(
    () => visibleGroups.find((g) => g.links.some((l) => l.key === activeKey))?.id,
    [activeKey, visibleGroups]
  );
  const [openGroup, setOpenGroup] = useState<string | undefined>(activeGroupId);

  // Deliberately NOT gating render on a separate "mounted" state that only gets set
  // true/false from inside the Animated.timing calls below — on a cold app start with
  // an already-restored login session (no explicit Login screen in between), this was
  // the app's very first native-driven animation, and on some Android devices/timings
  // that first `useNativeDriver: true` animation's completion callback can be dropped
  // by the bridge, silently leaving `mounted` stuck at its initial value forever (the
  // drawer would then never render at all, no matter how many times the hamburger was
  // tapped) — while every other interaction on the same topbar (e.g. the logout
  // button, which doesn't depend on this component) kept working fine. Rendering is
  // now a pure, synchronous function of the `visible` prop instead, immune to whether
  // the slide animation itself successfully fires.
  useEffect(() => {
    if (visible) setOpenGroup(activeGroupId);
    Animated.timing(translateX, {
      toValue: visible ? 0 : -DRAWER_WIDTH,
      duration: visible ? 220 : 200,
      useNativeDriver: true,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, DRAWER_WIDTH]);

  const go = (key: string) => {
    resetTo(key);
    onClose();
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={visible ? 'box-none' : 'none'}>
      {visible && <Pressable style={styles.backdrop} onPress={onClose} />}
      <Animated.View style={[styles.drawer, { width: DRAWER_WIDTH, paddingTop: insets.top, transform: [{ translateX }] }]}>
        <View style={styles.brand}>
          <View style={styles.logoMark}>
            <Text style={styles.logoMarkText}>HR</Text>
          </View>
          <Text style={styles.brandLabel}>HRMS Suite</Text>
        </View>

        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionLabel}>Main</Text>
          <SidebarLinkRow label="Dashboard" icon="grid" active={activeKey === 'AdminDashboard'} onPress={() => go('AdminDashboard')} />

          {visibleGroups.map((group) => {
            const open = openGroup === group.id;
            return (
              <View key={group.id}>
                <Pressable
                  style={[styles.groupHeader, open && styles.groupHeaderOpen]}
                  onPress={() => setOpenGroup(open ? undefined : group.id)}
                >
                  <Icon name={group.icon} size={18} color="rgba(255,255,255,0.85)" />
                  <Text style={styles.groupLabel}>{group.label}</Text>
                  <View style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}>
                    <Icon name="chevronDown" size={14} color="rgba(255,255,255,0.55)" />
                  </View>
                </Pressable>
                {open &&
                  group.links.map((link) => (
                    <Pressable
                      key={link.key}
                      style={[styles.subLink, link.key === activeKey && styles.subLinkActive]}
                      onPress={() => go(link.key)}
                    >
                      <View style={[styles.subDot, link.key === activeKey && styles.subDotActive]} />
                      <Text style={[styles.subLinkText, link.key === activeKey && styles.subLinkTextActive]}>{link.label}</Text>
                    </Pressable>
                  ))}
              </View>
            );
          })}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
          <Text style={styles.footerText}>Apna Payroll v1.0 — © {new Date().getFullYear()}</Text>
        </View>
      </Animated.View>
    </View>
  );
}

function SidebarLinkRow({ label, icon, active, onPress }: { label: string; icon: IconName; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.groupHeader, active && styles.groupHeaderOpen]} onPress={onPress}>
      <Icon name={icon} size={18} color="rgba(255,255,255,0.85)" />
      <Text style={styles.groupLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,13,35,0.5)' },
  drawer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: A.sidebarBg,
    paddingHorizontal: 10,
    shadowColor: '#000',
    shadowOffset: { width: 12, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 32,
    elevation: 16,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 8, paddingVertical: 16 },
  logoMark: { width: 34, height: 34, borderRadius: 10, backgroundColor: A.primary, alignItems: 'center', justifyContent: 'center' },
  logoMarkText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  brandLabel: { color: '#fff', fontWeight: '800', fontSize: 15 },
  sectionLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', paddingHorizontal: 12, marginTop: 14, marginBottom: 4 },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 11, borderRadius: 10, marginBottom: 2 },
  groupHeaderOpen: { backgroundColor: 'rgba(255,255,255,0.06)' },
  groupLabel: { flex: 1, color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: '500' },
  subLink: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 38, paddingRight: 12, paddingVertical: 9, borderRadius: 10, marginBottom: 1 },
  subLinkActive: { backgroundColor: A.primary },
  subDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: 'rgba(255,255,255,0.3)' },
  subDotActive: { backgroundColor: '#fff' },
  // flex + flexShrink so the label is bounded by the row's actual available
  // width and wraps onto a second line if it doesn't fit, instead of Android's
  // default hard clip (no flex/shrink here previously meant the Text sized to
  // its own unwrapped content and got cut off mid-word on narrower rows).
  subLinkText: { flex: 1, flexShrink: 1, color: 'rgba(255,255,255,0.75)', fontSize: 13 },
  subLinkTextActive: { color: '#fff', fontWeight: '700' },
  footer: { paddingHorizontal: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
  footerText: { color: 'rgba(255,255,255,0.4)', fontSize: 11 },
});
