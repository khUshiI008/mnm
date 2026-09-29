import client from './client';

export type SalesTargetMode = 'today' | 'week' | 'month';

export type NextSlabInfo = {
  achievementPct: number;
  deltaValue: number;
  deltaQty: number;
  payoutAtNextSlab: number;
};

export type SalesTargetPacing = {
  monthlyTargetValue: number;
  monthlyTargetQty: number;
  daysInMonth: number;
  daysElapsed: number;
  daysRemaining: number;
  mtdProrataTargetValue: number;
  mtdProrataTargetQty: number;
  mtdAchievedValue: number;
  mtdAchievedQty: number;
  monthlyAchValuePct: number;
  monthlyAchQtyPct: number;
  projectedEndValue: number;
  projectedEndQty: number;
  mtdEarnedReward: number;
  projectedPayout: number;
  projectedSlabPct: number | null;
  projDayValueComponent: number;
  projDayQtyComponent: number;
  projSlabValueComponent: number;
  projSlabQtyComponent: number;
  projPerPcsComponent: number;
  runRateStatus: 'superstar' | 'on_track' | 'needs_push' | 'behind_target';
  neededPerDayValue: number;
  neededPerDayQty: number;
  nextSlab: NextSlabInfo | null;
};

export type BillRow = {
  no: string;
  dateStr: string;
  brand: string | null;
  dept: string | null;
  article: string | null;
  category: string | null;
  color: string | null;
  size: string | null;
  amount: number;
  qty: number;
  mrp: number;
  discount: number;
};

export type DaySale = {
  date: string;
  value: number;
  qty: number;
  bills: BillRow[];
};

export type DayTarget = {
  date: string;
  dow: string;
  label: string;
  vTarget: number;
  qTarget: number;
  vMult: number;
  qMult: number;
  vReward: number;
  qReward: number;
};

export type SlabTier = {
  pct: number; // Value achievement threshold
  qPct: number; // Qty achievement threshold (independent since Sep 2026; falls back to pct pre-migration)
  vRew: number; // % of achieved value
  qRew: number; // ₹ per piece
};

export type TeamMember = {
  employeeId: number;
  employeeName: string;
  code: string | null;
  achievedValue: number;
  achievedQty: number;
  achValuePct: number;
  achQtyPct: number;
};

export type TeamSummary = {
  grossTargetValue: number;
  grossTargetQty: number;
  teamAchievedValue: number;
  teamAchievedQty: number;
  teamAchValuePct: number;
  teamAchQtyPct: number;
  teamSize: number;
  members: TeamMember[];
};

export type SalesTargetCard = {
  salesTargetId: number;
  targetName: string;
  salesScope: 'Personal' | 'Overall';
  weekStart: string;
  weekFrom: string;
  weekTo: string;
  weeklyTargetValue: number;
  weeklyTargetQty: number;
  totalValue: number;
  totalQty: number;
  achValuePct: number;
  achQtyPct: number;
  isQtyOnly: boolean;
  isValueOnly: boolean;
  isBothMode: boolean;
  dayValueReward: number;
  dayQtyReward: number;
  slabValueReward: number; // % of the qualifying slab (display only)
  slabValueRewardRupees: number;
  slabQtyReward: number;
  qtyRewardPerPcs: number;
  perPcsEarned: number;
  totalCashReward: number;
  brandNames: string[];
  deptNames: string[];
  branchNames: string[];
  dayTargets: DayTarget[];
  daySales: DaySale[];
  slabs: SlabTier[];
  pacing: SalesTargetPacing;
  teamSummary: TeamSummary | null;
};

export type OverallTeamSummary = {
  grossTargetValue: number;
  grossTargetQty: number;
  achievedValue: number;
  achievedQty: number;
  achValuePct: number;
  achQtyPct: number;
  totalManagedTargets: number;
  totalEmployees: number;
};

export type ByEmployeeRow = {
  employeeId: number;
  employeeName: string;
  code: string | null;
  achievedValue: number;
  achievedQty: number;
};

export type BarcodeIncentiveTeamMember = {
  name: string;
  qty: number;
  earned: number;
};

export type BarcodeIncentive = {
  barcodeTargetId: number;
  brands: string[];
  effectiveFrom: string;
  effectiveTo: string | null; // null = ongoing
  barcodeCount: number;
  isEmployee: boolean;
  isManager: boolean;
  // Employee side — the viewer's own matching-barcode qty × PcsAmount.
  pcsAmount: number;
  employeeQty: number;
  employeeEarned: number;
  // Manager side — summed across every employee assigned to this same barcode target.
  managerPcsAmount: number | null;
  managerQty: number;
  managerEarned: number;
  teamBreakdown: BarcodeIncentiveTeamMember[] | null;
};

export type MySalesTargetResponse = {
  success: boolean;
  targets: SalesTargetCard[];
  overallTeamSummary: OverallTeamSummary | null;
  byEmployee: ByEmployeeRow[];
  barcodeIncentives: BarcodeIncentive[];
  mode: SalesTargetMode;
  offset: number;
  periodLabel: string;
  today: string;
};

export const getMySalesTarget = (mode: SalesTargetMode, offset: number) =>
  client.get<MySalesTargetResponse>('/sales-target/my-target', { params: { mode, offset } });
