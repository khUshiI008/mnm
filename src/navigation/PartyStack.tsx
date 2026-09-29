import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PartyDashboardScreen from '../screens/party/PartyDashboardScreen';
import PartySaleReportScreen from '../screens/party/PartySaleReportScreen';
import PartyStockCheckScreen from '../screens/party/PartyStockCheckScreen';
import PartyBalanceStockScreen from '../screens/party/PartyBalanceStockScreen';
import Icon, { IconName } from '../components/Icon';
import { colors } from '../theme';
import { useAuth } from '../context/AuthContext';

const P = colors.party;

/**
 * Node port of Party/Dashboard.Master's bottom nav — a Party session's whole
 * destination set: Dashboard (analytics landing page), Sale Report, Stock
 * Check, Balance Stock. No Manage/Payslips/etc. — Party is a read-only
 * external-facing role, distinct from Employee/Admin.
 */
function HeaderRight() {
  const { signOut } = useAuth();
  return (
    <Pressable onPress={signOut} style={styles.headerIconBox} hitSlop={8}>
      <Icon name="logOut" size={18} color={P.ink} />
    </Pressable>
  );
}
const headerRight = () => <HeaderRight />;

function makeSingleScreenTab(name: string, Component: React.ComponentType<any>, title: string) {
  const Nav = createNativeStackNavigator();
  return function TabStack() {
    return (
      <Nav.Navigator screenOptions={{ headerTintColor: P.primary, headerRight }}>
        <Nav.Screen name={name} component={Component} options={{ title }} />
      </Nav.Navigator>
    );
  };
}

const DashboardTab = makeSingleScreenTab('Dashboard', PartyDashboardScreen, 'Dashboard');
const SaleReportTab = makeSingleScreenTab('SaleReport', PartySaleReportScreen, 'Sale Report');
const StockCheckTab = makeSingleScreenTab('StockCheck', PartyStockCheckScreen, 'Stock Check');
const BalanceStockTab = makeSingleScreenTab('BalanceStock', PartyBalanceStockScreen, 'Balance Stock');

const TAB_ICON: Record<string, IconName> = {
  Dashboard: 'grid',
  SaleReport: 'cashRegister',
  StockCheck: 'box',
  BalanceStock: 'barTrend',
};
const TAB_LABEL: Record<string, string> = {
  Dashboard: 'Dashboard',
  SaleReport: 'Sale Report',
  StockCheck: 'Stock Check',
  BalanceStock: 'Balance',
};

const Tab = createBottomTabNavigator();

function TabIcon({ routeName, color, focused }: { routeName: string; color: string; focused: boolean }) {
  return (
    <View style={[styles.iconPill, focused && styles.iconPillActive]}>
      <Icon name={TAB_ICON[routeName]} size={20} color={color} />
    </View>
  );
}

export default function PartyStack() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: P.primary,
        tabBarInactiveTintColor: P.muted,
        tabBarStyle: [styles.tabBar, { height: 60 + insets.bottom, paddingBottom: insets.bottom + 8 }],
        tabBarLabelStyle: styles.tabLabel,
        tabBarLabel: TAB_LABEL[route.name],
        tabBarIcon: ({ color, focused }) => <TabIcon routeName={route.name} color={color} focused={focused} />,
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardTab} />
      <Tab.Screen name="SaleReport" component={SaleReportTab} />
      <Tab.Screen name="StockCheck" component={StockCheckTab} />
      <Tab.Screen name="BalanceStock" component={BalanceStockTab} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: { paddingTop: 6, backgroundColor: P.surface, borderTopColor: P.border },
  tabLabel: { fontSize: 10, fontWeight: '700' },
  iconPill: { width: 40, height: 26, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  iconPillActive: { backgroundColor: 'rgba(13,148,136,0.12)' },
  headerIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: P.border,
    backgroundColor: P.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
});
