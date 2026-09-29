import client from './client';

export type TargetAnalysisMode = 'today' | 'week' | 'month';
export type PerformanceBucket = 'top' | 'well' | 'avg' | 'under' | 'critical';
export type TargetType = 'Value' | 'Qty' | 'Both';
export type SalesScope = 'Personal' | 'Overall';
export type PersonCategory = 'manager' | 'both' | 'attached' | 'staff';

export type TargetAnalysisRow = {
  salesTargetId: number;
  targetName: string;
  salesScope: SalesScope;
  scopeLabel: string;
  brandNames: string[];
  brandIds: number[];
  deptNames: string[];
  deptIds: number[];
  branchNames: string[];
  branchIds: number[];
  targetType: TargetType;
  employeeId: number;
  employeeName: string;
  code: string | null;
  role: 'Employee' | 'Manager' | 'Employee+Manager';
  personCategory: PersonCategory;
  personCategoryLabel: string;
  weeklyTargetValue: number;
  weeklyTargetQty: number;
  /** Grain-specific denominator — a single day's target in 'today' mode, weekly in 'week', monthly in 'month'. */
  targetValue: number;
  targetQty: number;
  /** Achieved figure measured against targetValue/targetQty (day-narrowed in 'today' mode). */
  totalValue: number;
  totalQty: number;
  achValuePct: number;
  achQtyPct: number;
  primaryPct: number;
  commissionEarned: number;
  /** Whole-target aggregate — identical on every row belonging to the same salesTargetId. */
  teamAchievedValue: number;
  teamAchievedQty: number;
  teamTargetValue: number;
  teamTargetQty: number;
  teamCommissionEarned: number;
  bucket: PerformanceBucket;
  achieved: boolean;
};

export type TargetAnalysisResponse = {
  success: boolean;
  rows: TargetAnalysisRow[];
  mode: TargetAnalysisMode;
  offset: number;
  periodLabel: string;
};

export const getTargetAnalysis = (mode: TargetAnalysisMode, offset: number) =>
  client.get<TargetAnalysisResponse>('/admin/target-analysis', { params: { mode, offset } });

/**
 * Optional one-tap "Good job!" on one specific target-achievement
 * notification — entirely skippable, and idempotent: `alreadySent: true`
 * means this achievement already got its one send (a repeat call, e.g. a
 * second tap on the same notification, never re-notifies the employee).
 */
export const sendGoodJobRemark = (salesTargetAchievementId: number) =>
  client.post<{ success: boolean; alreadySent: boolean; message: string }>(`/admin/sales-target/achievements/${salesTargetAchievementId}/remarks`);

/**
 * Read-only check — lets the modal know BEFORE rendering anything whether
 * this achievement already has a Good Job on it (sent automatically 3
 * minutes after the achievement, or by an admin manually), so it can show
 * the "already sent" confirmation (clapping sound included) immediately
 * instead of the "Send Good job?" prompt for something that's already done.
 */
export const getGoodJobStatus = (salesTargetAchievementId: number) =>
  client.get<{ success: boolean; alreadySent: boolean; isAuto: boolean; remarksBy: string | null; remarksAt: string | null }>(
    `/admin/sales-target/achievements/${salesTargetAchievementId}/remarks`
  );
