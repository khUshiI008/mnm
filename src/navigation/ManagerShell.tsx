import React, { useEffect, useMemo, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import { colors } from '../theme';
import { AdminNavContext } from './AdminShell';
import RegistrationsScreen from '../screens/admin/RegistrationsScreen';
import EmployeesListScreen from '../screens/admin/EmployeesListScreen';
import EmployeeFormScreen from '../screens/admin/EmployeeFormScreen';
import LeaveApprovalScreen from '../screens/admin/LeaveApprovalScreen';

const A = colors.admin;

/**
 * Hosts the same admin screens used under AdminShell, for a permission-granted
 * manager reached via the employee app's "Manage" tab (see ManageHomeScreen /
 * EmployeeStack). Deliberately a small clone of AdminShell's stack-of-keys nav
 * (not a full react-navigation nested stack) so it can provide the exact same
 * AdminNavContext instance the reused screens already call useAdminNav() against
 * — no forking of their navigation logic. The screens themselves stay
 * permission-aware via usePermission()/useAllowedFields(), not this shell.
 */
const MANAGER_SCREENS: Record<string, React.ComponentType<any>> = {
  EmployeeRegistrations: RegistrationsScreen,
  Employees: EmployeesListScreen,
  EmployeeForm: EmployeeFormScreen,
  LeaveApproval: LeaveApprovalScreen,
};

const TITLES: Record<string, string> = {
  EmployeeRegistrations: 'Employee Registrations',
  Employees: 'Employees',
  EmployeeForm: 'Employee',
  LeaveApproval: 'Leave Approval',
};

type ManagerRoute = { key: string; params?: any };

export default function ManagerShell({ initialKey, onExit }: { initialKey: string; onExit: () => void }) {
  const insets = useSafeAreaInsets();
  const [stack, setStack] = useState<ManagerRoute[]>([{ key: initialKey }]);
  const current = stack[stack.length - 1];

  const navValue = useMemo(
    () => ({
      route: current,
      navigate: (key: string, params?: any) => setStack((s) => [...s, { key, params }]),
      goBack: () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s)),
      canGoBack: stack.length > 1,
      resetTo: (key: string, params?: any) => setStack([{ key, params }]),
    }),
    [current, stack.length]
  );

  const Screen = MANAGER_SCREENS[current.key];
  const handleBack = () => (navValue.canGoBack ? navValue.goBack() : onExit());

  // Same custom-stack caveat as AdminShell — wire the hardware back button to
  // this shell's own stack instead of falling through to the OS default.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleBack();
      return true;
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stack.length]);

  return (
    <AdminNavContext.Provider value={navValue}>
      <View style={styles.root}>
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <Pressable style={styles.backBtn} onPress={handleBack}>
            <Icon name="chevronLeft" size={22} color={A.ink} />
          </Pressable>
          <Text style={styles.title} numberOfLines={1}>
            {current.params?.title || TITLES[current.key] || current.key}
          </Text>
        </View>
        <View style={styles.content}>{Screen ? <Screen params={current.params} /> : null}</View>
      </View>
    </AdminNavContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: A.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingBottom: 10,
    gap: 6,
    backgroundColor: A.surface,
    borderBottomWidth: 1,
    borderBottomColor: A.border,
  },
  backBtn: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: 16, fontWeight: '800', color: A.ink },
  content: { flex: 1 },
});
