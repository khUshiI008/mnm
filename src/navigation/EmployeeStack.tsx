import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DashboardScreen from '../screens/employee/DashboardScreen';
import AttendanceScreen from '../screens/employee/AttendanceScreen';
import StockCheckScreen from '../screens/employee/StockCheckScreen';
import LiveStockScreen from '../screens/employee/LiveStockScreen';
import SaleReportScreen from '../screens/employee/SaleReportScreen';
import ArticlePictureScreen from '../screens/employee/ArticlePictureScreen';
import BarcodeEarnedScreen from '../screens/employee/BarcodeEarnedScreen';
import SalesTargetScreen from '../screens/employee/SalesTargetScreen';
import LeavesScreen from '../screens/employee/LeavesScreen';
import PayslipsScreen from '../screens/employee/PayslipsScreen';
import PayslipDetailScreen from '../screens/employee/PayslipDetailScreen';
import LoansScreen from '../screens/employee/LoansScreen';
import RequestLoanScreen from '../screens/employee/RequestLoanScreen';
import AdvancesScreen from '../screens/employee/AdvancesScreen';
import ProfileScreen from '../screens/employee/ProfileScreen';
import ManageHomeScreen from '../screens/employee/ManageHomeScreen';
import ManagerShell from './ManagerShell';
import Icon, { IconName } from '../components/Icon';
import NotificationBell from '../components/NotificationBell';
import OverdueLoanAlert from '../components/OverdueLoanAlert';
import LoanDueTodayAlert from '../components/LoanDueTodayAlert';
import { colors } from '../theme';
import { useAuth } from '../context/AuthContext';
import { confirmSignOut } from '../utils/confirmSignOut';

const E = colors.emp;

// Each tab gets its own native-stack (even single-screen ones) so every
// screen keeps the same header/title/back behavior it had in the old flat
// stack — only the outer shell (tab bar vs single stack) has changed.
//
// Icon buttons are wrapped in a bordered box here (matching .emp-icon-btn:
// 38x38, radius 10, 1px border, surface bg) rather than restyling
// NotificationBell itself, since that component is also shared by
// AdminTopbar — the admin header stays untouched.
function HeaderRight() {
  const { signOut } = useAuth();
  return (
    <View style={styles.headerRightRow}>
      <View style={styles.headerIconBox}>
        <NotificationBell color={E.ink} />
      </View>
      <Pressable onPress={() => confirmSignOut(signOut)} style={styles.headerIconBox} hitSlop={8}>
        <Icon name="logOut" size={18} color={E.ink} />
      </Pressable>
    </View>
  );
}
const headerRight = () => <HeaderRight />;

function greetingPeriod(d: Date) {
  const h = d.getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

/** Mirrors .emp-header-title's h1 + p — reused for any screen that needs a subtitle line under its title. */
function ScreenHeaderTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View>
      <Text style={styles.headerTitleText}>{title}</Text>
      <Text style={styles.headerSubtitleText}>{subtitle}</Text>
    </View>
  );
}

/** Mirrors .emp-header-title's h1 ("My Dashboard") + p ("Good {period}, {FirstName}!"). */
function DashboardHeaderTitle() {
  const { user } = useAuth();
  const firstName = (user?.name || '').split(' ')[0] || 'there';
  return <ScreenHeaderTitle title="My Dashboard" subtitle={`Good ${greetingPeriod(new Date())}, ${firstName}!`} />;
}

function makeSingleScreenTab(name: string, Component: React.ComponentType<any>, title: string, subtitle?: string) {
  const Nav = createNativeStackNavigator();
  const options = subtitle ? { headerTitle: () => <ScreenHeaderTitle title={title} subtitle={subtitle} /> } : { title };
  return function TabStack() {
    return (
      <Nav.Navigator screenOptions={{ headerTintColor: E.primary, headerRight }}>
        <Nav.Screen name={name} component={Component} options={options} />
      </Nav.Navigator>
    );
  };
}

const DashboardStackNav = createNativeStackNavigator();
function DashboardTab() {
  return (
    <DashboardStackNav.Navigator screenOptions={{ headerTintColor: E.primary, headerRight }}>
      <DashboardStackNav.Screen name="DashboardHome" component={DashboardScreen} options={{ headerTitle: DashboardHeaderTitle }} />
      <DashboardStackNav.Screen name="Attendance" component={AttendanceScreen} options={{ title: 'My Attendance' }} />
      <DashboardStackNav.Screen name="StockCheck" component={StockCheckScreen} options={{ title: 'Stock Check' }} />
      <DashboardStackNav.Screen name="LiveStock" component={LiveStockScreen} options={{ title: 'Live Stock' }} />
      <DashboardStackNav.Screen name="SaleReport" component={SaleReportScreen} options={{ title: 'Sale Report' }} />
      <DashboardStackNav.Screen name="ArticlePicture" component={ArticlePictureScreen} options={{ title: 'Article Picture' }} />
      <DashboardStackNav.Screen name="BarcodeEarned" component={BarcodeEarnedScreen} options={{ title: 'Barcode Wise Earned' }} />
    </DashboardStackNav.Navigator>
  );
}

const PayslipsStackNav = createNativeStackNavigator();
function PayslipsTab() {
  return (
    <PayslipsStackNav.Navigator screenOptions={{ headerTintColor: E.primary, headerRight }}>
      <PayslipsStackNav.Screen name="PayslipsHome" component={PayslipsScreen} options={{ title: 'Payslips' }} />
      <PayslipsStackNav.Screen name="PayslipDetail" component={PayslipDetailScreen} options={{ title: 'Payslip' }} />
    </PayslipsStackNav.Navigator>
  );
}

const LoansStackNav = createNativeStackNavigator();
function LoansTab() {
  return (
    <LoansStackNav.Navigator screenOptions={{ headerTintColor: E.primary, headerRight }}>
      <LoansStackNav.Screen name="Loans" component={LoansScreen} options={{ title: 'Loans' }} />
      <LoansStackNav.Screen name="RequestLoan" component={RequestLoanScreen} options={{ title: 'Request a Loan' }} />
    </LoansStackNav.Navigator>
  );
}

// Route names below are kept IDENTICAL to the old flat-stack screen names
// ('Leaves', 'Loans', 'Advances', 'Profile', 'Attendance', 'PayslipDetail')
// because several screens call navigation.navigate('Profile'/'Leaves'/etc.)
// expecting to bubble up to a sibling route by that exact name (e.g.
// TrialGate.tsx, DashboardScreen.tsx's quick-link grid, PayslipsScreen.tsx's
// "View full slip" button). Renaming these would silently break navigation.
const TargetTab = makeSingleScreenTab('Target', SalesTargetScreen, 'My Sales Target');
const LeavesTab = makeSingleScreenTab('Leaves', LeavesScreen, 'Leaves');
const AdvancesTab = makeSingleScreenTab('Advances', AdvancesScreen, 'Salary Advances');
const ProfileTab = makeSingleScreenTab('Profile', ProfileScreen, 'My Profile', 'Personal information, bank details & KYC documents');

// Deliberately NOT wrapped by makeSingleScreenTab — ManagerShell/ManageHomeScreen own their
// own header chrome (reusing the admin screens' navigation pattern, see ManagerShell.tsx),
// so this tab renders with no react-navigation header of its own.
function ManageTab() {
  const [activeModuleKey, setActiveModuleKey] = useState<string | null>(null);
  if (activeModuleKey) return <ManagerShell initialKey={activeModuleKey} onExit={() => setActiveModuleKey(null)} />;
  return <ManageHomeScreen onSelectModule={setActiveModuleKey} />;
}

// Matches WebApplication1/Employee/Dashboard.Master .emp-bottomnav — exact tab order/icons.
// 'Manage' is the one addition, only shown to employees holding manager permission grants.
const TAB_ICON: Record<string, IconName> = {
  Dashboard: 'grid',
  Target: 'barTrend',
  Leaves: 'document',
  Payslips: 'dollar',
  Loans: 'bank',
  Advances: 'trendingUp',
  Manage: 'gear',
  Profile: 'user',
};
const TAB_LABEL: Record<string, string> = {
  Dashboard: 'Dashboard',
  Target: 'Target',
  Leaves: 'Leaves',
  Payslips: 'Payslips',
  Loans: 'Loans',
  Advances: 'Advance',
  Manage: 'Manage',
  Profile: 'Profile',
};

const Tab = createBottomTabNavigator();

function TabIcon({ routeName, color, focused }: { routeName: string; color: string; focused: boolean }) {
  return (
    <View style={[styles.iconPill, focused && styles.iconPillActive]}>
      <Icon name={TAB_ICON[routeName]} size={20} color={color} />
    </View>
  );
}

export default function EmployeeStack() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const hasManagerAccess = (user?.permissions?.length ?? 0) > 0;

  return (
    <>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: E.primary,
          tabBarInactiveTintColor: E.muted,
          // Fixed height/paddingBottom here would sit under Android's gesture
          // nav bar on devices with a tall inset — pad by insets.bottom like
          // AdminBottomNav does, instead of a flat 8.
          tabBarStyle: [styles.tabBar, { height: 60 + insets.bottom, paddingBottom: insets.bottom + 8 }],
          tabBarLabelStyle: styles.tabLabel,
          tabBarLabel: TAB_LABEL[route.name],
          tabBarIcon: ({ color, focused }) => <TabIcon routeName={route.name} color={color} focused={focused} />,
        })}
      >
        <Tab.Screen name="Dashboard" component={DashboardTab} />
        <Tab.Screen name="Target" component={TargetTab} />
        <Tab.Screen name="Leaves" component={LeavesTab} />
        <Tab.Screen name="Payslips" component={PayslipsTab} />
        <Tab.Screen name="Loans" component={LoansTab} />
        <Tab.Screen name="Advances" component={AdvancesTab} />
        {hasManagerAccess && <Tab.Screen name="Manage" component={ManageTab} />}
        <Tab.Screen name="Profile" component={ProfileTab} />
      </Tab.Navigator>
      {/* Siblings of the tab navigator (not screens inside it) so they're visible
          regardless of which tab the employee lands on — see OverdueLoanAlert.tsx
          and LoanDueTodayAlert.tsx. An employee with both an overdue EMI and a
          separate EMI due today sees each alert in turn (dismissing one reveals
          the other) rather than either being silently suppressed. */}
      <OverdueLoanAlert />
      <LoanDueTodayAlert />
    </>
  );
}

const styles = StyleSheet.create({
  tabBar: { paddingTop: 6, backgroundColor: E.surface, borderTopColor: E.border },
  tabLabel: { fontSize: 10, fontWeight: '700' },
  iconPill: { width: 40, height: 26, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  iconPillActive: { backgroundColor: 'rgba(67,97,238,0.1)' },
  headerRightRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 4 },
  // Mirrors .emp-icon-btn: 38x38, radius 10, 1px border, surface background.
  headerIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: E.border,
    backgroundColor: E.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Mirrors .emp-header-title h1 / p.
  headerTitleText: { fontSize: 17, fontWeight: '800', color: E.ink },
  headerSubtitleText: { fontSize: 12, color: E.muted, marginTop: 1 },
});
