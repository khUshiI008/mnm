import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
import { colors } from '../theme';
import { ADMIN_MODULES, AdminModule } from './adminModules';
import { registerAdminDeepLinkHandler, unregisterAdminDeepLinkHandler } from './adminDeepLink';
import ComingSoonScreen from '../screens/admin/ComingSoonScreen';
import AdminTopbar from '../components/admin/AdminTopbar';
import AdminBottomNav from '../components/admin/AdminBottomNav';
import AdminSidebar from '../components/admin/AdminSidebar';
import AdminDashboardScreen from '../screens/admin/DashboardScreen';
import ModuleMenuScreen from '../screens/admin/ModuleMenuScreen';
import DrillDownListScreen from '../screens/admin/DrillDownListScreen';
import OverdueReceivablesScreen from '../screens/admin/OverdueReceivablesScreen';
import RegistrationsScreen from '../screens/admin/RegistrationsScreen';
import PermissionsScreen from '../screens/admin/PermissionsScreen';
import EmployeesListScreen from '../screens/admin/EmployeesListScreen';
import EmployeeFormScreen from '../screens/admin/EmployeeFormScreen';
import AssignShiftScreen from '../screens/admin/AssignShiftScreen';
import EmployeeApprovedScreen from '../screens/admin/EmployeeApprovedScreen';
import MissedPunchesScreen from '../screens/admin/MissedPunchesScreen';
import EmployeeBreakdownScreen from '../screens/admin/EmployeeBreakdownScreen';
import LeaveApprovalScreen from '../screens/admin/LeaveApprovalScreen';
import LeaveAdminScreen from '../screens/admin/LeaveAdminScreen';
import LeaveApplicationScreen from '../screens/admin/LeaveApplicationScreen';
import SalaryAdvanceScreen from '../screens/admin/SalaryAdvanceScreen';
import LoanDashboardScreen from '../screens/admin/LoanDashboardScreen';
import OrganizationScreen from '../screens/admin/OrganizationScreen';
import LocationScreen from '../screens/admin/LocationScreen';
import EmployeeMastersScreen from '../screens/admin/EmployeeMastersScreen';
import ShiftScreen from '../screens/admin/ShiftScreen';
import ShiftHierarchyScreen from '../screens/admin/ShiftHierarchyScreen';
import AttendancePolicyScreen from '../screens/admin/AttendancePolicyScreen';
import LeaveTypeScreen from '../screens/admin/LeaveTypeScreen';
import LeavePolicyScreen from '../screens/admin/LeavePolicyScreen';
import SalaryAdvancePolicyScreen from '../screens/admin/SalaryAdvancePolicyScreen';
import EmployeesImportScreen from '../screens/admin/EmployeesImportScreen';
import SalesMasterDataScreen from '../screens/admin/SalesMasterDataScreen';
import StaffLoanScreen from '../screens/admin/StaffLoanScreen';
import EmailInboxScreen from '../screens/admin/EmailInboxScreen';
import StaffLoanDetailScreen from '../screens/admin/StaffLoanDetailScreen';
import PayrollLoanScreen from '../screens/admin/PayrollLoanScreen';
import PayrollLoanDetailScreen from '../screens/admin/PayrollLoanDetailScreen';
import SalaryHeadScreen from '../screens/admin/SalaryHeadScreen';
import SalaryRevisionScreen from '../screens/admin/SalaryRevisionScreen';
import PayrollScreen from '../screens/admin/PayrollScreen';
import MonthlyRecoveryScreen from '../screens/admin/MonthlyRecoveryScreen';
import ImportPunchScreen from '../screens/admin/ImportPunchScreen';
import AttendanceReportScreen from '../screens/admin/AttendanceReportScreen';
import BiometricReportScreen from '../screens/admin/BiometricReportScreen';
import AttendancePartialScreen from '../screens/admin/AttendancePartialScreen';
import BiometricPartialScreen from '../screens/admin/BiometricPartialScreen';
import PerformanceReportScreen from '../screens/admin/PerformanceReportScreen';
import ThemeStudioScreen from '../screens/admin/ThemeStudioScreen';
import TargetGenerateScreen from '../screens/admin/TargetGenerateScreen';
import TargetGenerateFormScreen from '../screens/admin/TargetGenerateFormScreen';
import BarcodeTargetFormScreen from '../screens/admin/BarcodeTargetFormScreen';
import TargetAnalysisScreen from '../screens/admin/TargetAnalysisScreen';
import SalesDashboardScreen from '../screens/admin/SalesDashboardScreen';
import SalesReportsHubScreen from '../screens/admin/SalesReportsHubScreen';
import SalesReportDetailScreen from '../screens/admin/SalesReportDetailScreen';
import SalesReportScreen from '../screens/admin/SalesReportScreen';
import OrdersListScreen from '../screens/admin/OrdersListScreen';
import OrderUploadScreen from '../screens/admin/OrderUploadScreen';
import OrderItemsScreen from '../screens/admin/OrderItemsScreen';
import PTUploadListScreen from '../screens/admin/PTUploadListScreen';
import PTUploadWizardScreen from '../screens/admin/PTUploadWizardScreen';
import PTUploadItemsScreen from '../screens/admin/PTUploadItemsScreen';
import MorningQuotesScreen from '../screens/admin/MorningQuotesScreen';
import ScannerAccessScreen from '../screens/admin/ScannerAccessScreen';
import SoldBarcodePaymentsScreen from '../screens/admin/SoldBarcodePaymentsScreen';
import BarcodeTargetListScreen from '../screens/admin/BarcodeTargetListScreen';
import BarcodeTargetConflictsScreen from '../screens/admin/BarcodeTargetConflictsScreen';
import PartyPanelListScreen from '../screens/admin/PartyPanelListScreen';
import PartyPanelFormScreen from '../screens/admin/PartyPanelFormScreen';
import FastMovingSessionsScreen from '../screens/admin/FastMovingSessionsScreen';
import CurrentSalePerfSessionsScreen from '../screens/admin/CurrentSalePerfSessionsScreen';
import PurchaseMovingSessionsScreen from '../screens/admin/PurchaseMovingSessionsScreen';
import PartyDashboardScreen from '../screens/party/PartyDashboardScreen';

/**
 * Real screens get registered here module-by-module as each admin phase
 * ships (key matches adminModules.ts's `key`). Anything not in this map
 * falls through to ComingSoonScreen, so the sidebar/bottom-nav always work
 * even for modules that aren't built yet. 'DrillDown' is a synthetic route
 * (not in adminModules.ts) pushed by KPI-card/dept-box taps.
 */
export const ADMIN_SCREENS: Record<string, React.ComponentType<any>> = {
  AdminDashboard: AdminDashboardScreen,
  // Synthetic route (not in adminModules.ts) — the Home tab's module-list menu.
  // Also used, with a `groupId` param, for a single module's submodule list.
  HomeMenu: ModuleMenuScreen,
  DrillDown: DrillDownListScreen,
  OverdueReceivables: OverdueReceivablesScreen,
  EmployeeRegistrations: RegistrationsScreen,
  Permissions: PermissionsScreen,
  MorningQuotes: MorningQuotesScreen,
  ScannerAccess: ScannerAccessScreen,
  Employees: EmployeesListScreen,
  EmployeeForm: EmployeeFormScreen,
  AssignShift: AssignShiftScreen,
  EmployeeApproved: EmployeeApprovedScreen,
  MissedPunches: MissedPunchesScreen,
  EmployeeBreakdown: EmployeeBreakdownScreen,
  LeaveApproval: LeaveApprovalScreen,
  LeaveAdmin: LeaveAdminScreen,
  LeaveApplicationAdmin: LeaveApplicationScreen,
  SalaryAdvance: SalaryAdvanceScreen,
  LoanDashboard: LoanDashboardScreen,
  Organization: OrganizationScreen,
  Locations: LocationScreen,
  EmployeeMasters: EmployeeMastersScreen,
  Shifts: ShiftScreen,
  ShiftHierarchy: ShiftHierarchyScreen,
  AttendancePolicies: AttendancePolicyScreen,
  LeaveTypes: LeaveTypeScreen,
  LeavePolicies: LeavePolicyScreen,
  SalaryAdvancePolicies: SalaryAdvancePolicyScreen,
  EmployeesImport: EmployeesImportScreen,
  SalesMasterData: SalesMasterDataScreen,
  StaffLoans: StaffLoanScreen,
  EmailInbox: EmailInboxScreen,
  StaffLoanDetail: StaffLoanDetailScreen,
  PayrollLoans: PayrollLoanScreen,
  PayrollLoanDetail: PayrollLoanDetailScreen,
  SalaryHeads: SalaryHeadScreen,
  SalaryRevisions: SalaryRevisionScreen,
  Payroll: PayrollScreen,
  MonthlyRecoveries: MonthlyRecoveryScreen,
  ImportPunch: ImportPunchScreen,
  AttendanceReport: AttendanceReportScreen,
  BiometricReport: BiometricReportScreen,
  AttendancePartial: AttendancePartialScreen,
  BiometricPartial: BiometricPartialScreen,
  PerformanceReport: PerformanceReportScreen,
  ThemeStudio: ThemeStudioScreen,
  TargetGenerate: TargetGenerateScreen,
  TargetGenerateForm: TargetGenerateFormScreen,
  BarcodeTargetForm: BarcodeTargetFormScreen,
  BarcodeTargetList: BarcodeTargetListScreen,
  BarcodeTargetConflicts: BarcodeTargetConflictsScreen,
  SoldBarcodePayments: SoldBarcodePaymentsScreen,
  PartyPanel: PartyPanelListScreen,
  PartyPanelForm: PartyPanelFormScreen,
  FastMovingSessions: FastMovingSessionsScreen,
  CurrentSalePerfSessions: CurrentSalePerfSessionsScreen,
  PurchaseMovingSessions: PurchaseMovingSessionsScreen,
  // Admin Preview — the real Party self-service Dashboard, reused verbatim
  // with a previewPartyId param (see requirePartyOrAdminPreview) so an admin
  // can inspect a Party's own dashboard read-only without logging in as them.
  PartyDashboardPreview: PartyDashboardScreen,
  TargetAnalysis: TargetAnalysisScreen,
  SalesDashboard: SalesDashboardScreen,
  SalesReportsHub: SalesReportsHubScreen,
  SalesReportDetail: SalesReportDetailScreen,
  SalesReport: SalesReportScreen,
  Orders: OrdersListScreen,
  OrderUpload: OrderUploadScreen,
  OrderItems: OrderItemsScreen,
  PTUpload: PTUploadListScreen,
  PTUploadWizard: PTUploadWizardScreen,
  PTUploadItems: PTUploadItemsScreen,
};

type AdminRoute = { key: string; params?: any };

type AdminNavValue = {
  route: AdminRoute;
  navigate: (key: string, params?: any) => void;
  goBack: () => void;
  canGoBack: boolean;
  /** Used by sidebar/bottom-nav taps — replaces the whole stack, like following a fresh link on the web. */
  resetTo: (key: string, params?: any) => void;
};

// Exported (not just useAdminNav) so ManagerShell can provide its own value through the
// same context instance — the reused admin screens (RegistrationsScreen, EmployeeFormScreen,
// etc.) call useAdminNav() and don't care which shell is hosting them.
export const AdminNavContext = createContext<AdminNavValue | null>(null);

export function useAdminNav() {
  const ctx = useContext(AdminNavContext);
  if (!ctx) throw new Error('useAdminNav must be used within AdminShell');
  return ctx;
}

export function findAdminModule(key: string): AdminModule | undefined {
  return ADMIN_MODULES.find((m) => m.key === key);
}

export default function AdminShell() {
  // Admins land on the Attendance Dashboard (first bottom-nav tab); the Home
  // module menu is one tab over.
  const [stack, setStack] = useState<AdminRoute[]>([{ key: 'AdminDashboard' }]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const current = stack[stack.length - 1];

  const navValue = useMemo<AdminNavValue>(
    () => ({
      route: current,
      navigate: (key, params) => setStack((s) => [...s, { key, params }]),
      goBack: () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s)),
      canGoBack: stack.length > 1,
      resetTo: (key, params) => setStack([{ key, params }]),
    }),
    [current, stack.length]
  );

  // Lets a notification tap (handled in App.tsx, outside this component
  // entirely — including a cold start before this shell has even mounted
  // once) jump straight to a specific admin screen. setStack is a stable
  // useState setter, so this only needs to register once.
  useEffect(() => {
    registerAdminDeepLinkHandler((key, params) => setStack([{ key, params }]));
    return () => unregisterAdminDeepLinkHandler();
  }, []);

  // Android hardware back button — this shell keeps its own push/pop stack in
  // component state rather than react-navigation, so BackHandler doesn't know
  // about it by default. Without this, pressing back from any pushed screen
  // (e.g. a loan's detail view) falls through to the OS default and exits the
  // app instead of popping back to the previous screen.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (stack.length > 1) {
        setStack((s) => s.slice(0, -1));
        return true;
      }
      return false; // at the root screen — let the OS handle it (exit/minimize)
    });
    return () => sub.remove();
  }, [stack.length]);

  const Screen = ADMIN_SCREENS[current.key];
  const module = findAdminModule(current.key);

  return (
    <AdminNavContext.Provider value={navValue}>
      <View style={styles.root}>
        <AdminTopbar
          title={current.params?.title || module?.title || current.key}
          onMenuPress={() => setDrawerOpen(true)}
          onBackPress={navValue.canGoBack ? navValue.goBack : undefined}
        />
        <View style={styles.content}>{Screen ? <Screen params={current.params} /> : <ComingSoonScreen module={module} />}</View>
        <AdminBottomNav activeKey={current.key} />
      </View>
      <AdminSidebar visible={drawerOpen} onClose={() => setDrawerOpen(false)} activeKey={current.key} />
    </AdminNavContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.admin.bg },
  content: { flex: 1 },
});
