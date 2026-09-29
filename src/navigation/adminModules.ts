/**
 * Every admin/HR screen from the .NET Panel/* area (30 .aspx pages), listed
 * here so the app's navigation genuinely covers the full module set even
 * though only Phase 1 (Auth + Attendance) has a real backend + UI so far.
 * Each entry pushes ComingSoonScreen until its module is built — see
 * backend/MODELS_TODO.md and PROJECT_ROADMAP.md for the .NET source file
 * and suggested build order for each one.
 */
export type AdminModule = { key: string; title: string; group: string; source: string };

export const ADMIN_MODULES: AdminModule[] = [
  { key: 'AdminDashboard', title: 'Attendance Dashboard', group: 'Overview', source: 'Panel/Dashboard.aspx' },
  { key: 'HomeMenu', title: 'Home', group: 'Overview', source: 'N/A — new, mobile-only module menu (see ModuleMenuScreen)' },
  { key: 'EmailInbox', title: 'Email Inbox', group: 'Overview', source: 'N/A — new, mobile-only module (zero-cost Gmail monitoring, see EMAIL_INBOX_SETUP.md)' },

  { key: 'Employees', title: 'Employees', group: 'Employee', source: 'Panel/Employees/Index.aspx' },
  { key: 'EmployeesImport', title: 'Import Employees', group: 'Employee', source: 'Panel/Employees/Import.aspx' },
  { key: 'EmployeeMasters', title: 'Employee Masters', group: 'Employee', source: 'Panel/EmployeeMasters/Index.aspx' },
  { key: 'EmployeeRegistrations', title: 'Employee Registrations', group: 'Employee', source: 'Panel/EmployeeRegistrations/Index.aspx' },

  { key: 'Permissions', title: 'Permissions', group: 'Company', source: 'N/A — new, no .NET source' },

  { key: 'MorningQuotes', title: 'Quotes', group: 'Settings', source: 'N/A — new, mobile-only module' },
  { key: 'ScannerAccess', title: 'Scanner App Access', group: 'Scanner App', source: 'Panel/Settings/ScannerAccess/Index.aspx (who may log in to the aScanner app)' },

  { key: 'Orders', title: 'Order File Upload', group: 'Order', source: 'Panel/Orders/Index.aspx' },
  { key: 'PTUpload', title: 'Upload PT File', group: 'Order', source: 'Panel/PTUpload/Index.aspx' },

  { key: 'Organization', title: 'Organization', group: 'Setup', source: 'Panel/Organization/Index.aspx' },
  { key: 'Locations', title: 'Locations', group: 'Setup', source: 'Panel/Locations/Index.aspx' },
  { key: 'Shifts', title: 'Shifts', group: 'Setup', source: 'Panel/Shifts/Index.aspx' },
  { key: 'ShiftHierarchy', title: 'Shift Hierarchy', group: 'Setup', source: 'Panel/ShiftHierarchy/Index.aspx' },
  { key: 'AttendancePolicies', title: 'Attendance Policies', group: 'Setup', source: 'Panel/AttendancePolicies/Index.aspx' },
  { key: 'ThemeStudio', title: 'Theme Studio', group: 'Setup', source: 'Panel/ThemeStudio.aspx' },
  { key: 'PartyPanel', title: 'Party Panel', group: 'Setup', source: 'Panel/Settings/PartyPanel/Index.aspx' },

  { key: 'AttendanceReport', title: 'Attendance Report (plain, hidden)', group: 'Attendance', source: 'Panel/Attendance/Report.aspx' },
  { key: 'BiometricReport', title: 'Attendance Report', group: 'Attendance', source: 'Panel/Attendance/BiometricReport.aspx' },
  { key: 'BiometricPartial', title: 'Missed Punches', group: 'Attendance', source: 'Panel/Attendance/BiometricPartial.aspx' },
  { key: 'AttendancePartial', title: 'Partial Attendance', group: 'Attendance', source: 'Panel/Attendance/Partial.aspx' },
  { key: 'ImportPunch', title: 'Import Punch Data', group: 'Attendance', source: 'Panel/Attendance/ImportPunch.aspx' },

  { key: 'LeaveTypes', title: 'Leave Types', group: 'Leave', source: 'Panel/LeaveTypes/Index.aspx' },
  { key: 'LeavePolicies', title: 'Leave Policies', group: 'Leave', source: 'Panel/LeavePolicies/Index.aspx' },
  { key: 'LeaveApplicationAdmin', title: 'Leave Applications', group: 'Leave', source: 'Panel/LeaveApplication/Index.aspx' },
  { key: 'LeaveApproval', title: 'Leave Approval', group: 'Leave', source: 'Panel/LeaveApproval/Index.aspx' },
  { key: 'LeaveAdmin', title: 'Leave Admin', group: 'Leave', source: 'Panel/LeaveAdmin/Index.aspx' },

  { key: 'SalaryHeads', title: 'Salary Heads', group: 'Salary', source: 'Panel/SalaryHeads/Index.aspx' },
  { key: 'SalaryRevisions', title: 'Salary Revisions', group: 'Salary', source: 'Panel/SalaryRevisions/Index.aspx' },
  { key: 'SalaryAdvance', title: 'Salary Advance', group: 'Salary', source: 'Panel/SalaryAdvance/Index.aspx' },

  { key: 'Payroll', title: 'Payroll', group: 'Payroll', source: 'Panel/Payroll/Index.aspx' },

  { key: 'StaffLoans', title: 'Staff Brand Loans', group: 'Loan', source: 'Panel/StaffLoans/Index.aspx' },
  { key: 'PayrollLoans', title: 'Staff Loans', group: 'Loan', source: 'Panel/PayrollLoans/Index.aspx' },
  { key: 'LoanDashboard', title: 'Loan Dashboard', group: 'Loan', source: 'Panel/LoanDashboard/Index.aspx' },
  { key: 'SalaryAdvancePolicies', title: 'Advance Policy', group: 'Loan', source: 'Panel/SalaryAdvancePolicies/Index.aspx' },
  { key: 'MonthlyRecoveries', title: 'Monthly Recoveries', group: 'Loan', source: 'Panel/MonthlyRecoveries/Index.aspx' },

  { key: 'PerformanceReport', title: 'Staff Performance Report', group: 'MIS Reporting', source: 'Panel/Performance/Index.aspx' },

  // Sales — API Settings is configured via the .NET web admin panel only —
  // deliberately not exposed in the app. Categories intentionally not ported
  // as its own module — already covered by the Sales Master Data screen.
  { key: 'SalesMasterData', title: 'Sales Master Data', group: 'Sales', source: 'Panel/Sales/MasterData/Index.aspx + Panel/Sales/Categories/Index.aspx' },
  { key: 'SalesDashboard', title: 'Sales KPIs', group: 'Sales', source: 'Panel/Sales/Dashboard/Index.aspx' },
  { key: 'SalesReportsHub', title: 'Sales Dashboard', group: 'Sales', source: 'Panel/Sales/SaleAnalysisReport/Index.aspx + Panel/Sales/SalesAnalytics/Index.aspx' },
  { key: 'SalesReport', title: 'Sales Report', group: 'Sales', source: 'Panel/Sales/SalesReport/Index.aspx' },

  // Target — separate group from Sales per explicit request; shares the SalesTarget/
  // SalesTransaction schema with the employee-facing Sales Target tab.
  { key: 'TargetGenerate', title: 'Target Generate', group: 'Target', source: 'Panel/Sales/TargetGenerate/Index.aspx' },
  { key: 'TargetAnalysis', title: 'Target Analysis', group: 'Target', source: 'Panel/Sales/TargetAnalysis/Index.aspx' },
  { key: 'SoldBarcodePayments', title: 'Sold Barcode Payments', group: 'Target', source: 'Panel/Sales/SoldBarcodeList/Index.aspx' },
];
