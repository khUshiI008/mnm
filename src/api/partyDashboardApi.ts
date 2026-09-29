import client from './client';

export type ChartEntry = { label: string; key?: string; amount: number; qty: number; lyAmount?: number | null; lyQty?: number | null };

export type DashboardCharts = {
  day: ChartEntry[];
  category: ChartEntry[];
  size: ChartEntry[];
  color: ChartEntry[];
  department: ChartEntry[];
  session: ChartEntry[];
  mrp: ChartEntry[];
};

export type DashboardSummary = {
  billCount: number;
  returnCount: number;
  totQty: number;
  totAmt: number;
  calcCheck: boolean;
  totMrp: number;
  totDisc: number;
  avgDiscPct: number;
  asp: number;
  avgAmtPerBill: number;
  avgQtyPerBill: number;
  hasReturns: boolean;
  totReturnQty: number;
  totReturnAmt: number;
  avgDiscAmt: number;
  returnAvgPct: number;
};

export type DashboardFilters = {
  periodMode?: string;
  from?: string;
  to?: string;
  shift?: 'prev' | 'next';
  compareLY?: boolean;
  brandId?: number;
  selCategories?: string[];
  selSizes?: string[];
  selColors?: string[];
  selDepartments?: string[];
  selSessions?: string[];
  selMrps?: string[];
  selDates?: string[];
};

export type DashboardResponse = {
  success: boolean;
  periodMode: string;
  from: string;
  to: string;
  summary: DashboardSummary;
  charts: DashboardCharts;
  activeFilters: { dim: string; values: string[] }[];
  activeBrandId: number | null;
  brandOptions: { id: number; name: string }[];
  scope: { displayName: string; hideBrandName: boolean };
};

export const getDashboard = (filters: DashboardFilters, previewPartyId?: number) =>
  client.post<DashboardResponse>('/party/dashboard', filters, previewPartyId ? { params: { previewPartyId } } : undefined);

export type ChartKey = 'day' | 'category' | 'size' | 'color' | 'department' | 'session' | 'mrp';
export type ChartConfig = { type: 'bar' | 'line' | 'pie'; metric: 'amount' | 'qty'; visible: boolean };
export type DashboardLayout = {
  charts: Record<ChartKey, ChartConfig>;
  period: { mode: string; from?: string; to?: string };
  globalMetric: 'amount' | 'qty';
};

export const getDashboardLayout = (previewPartyId?: number) =>
  client.get<{ success: boolean; layout: DashboardLayout | null }>('/party/dashboard/layout', previewPartyId ? { params: { previewPartyId } } : undefined);
export const saveDashboardLayout = (layout: DashboardLayout, previewPartyId?: number) =>
  client.post<{ success: boolean }>('/party/dashboard/layout', { layout }, previewPartyId ? { params: { previewPartyId } } : undefined);
