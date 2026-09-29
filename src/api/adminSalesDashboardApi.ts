import client from './client';

export type SalesGroupRow = { name: string; net: number; disc: number; mrp: number; units: number; margin: number; discRate: number };

export type SalesDashboardKpis = {
  netRevenue: number;
  grossMarginPct: number;
  units: number;
  discRatePct: number;
  cogs: number;
  aov: number;
  transactions: number;
};

export type SalesDashboardResponse = {
  success: boolean;
  empty: boolean;
  fromDt?: string;
  toDt?: string;
  kpis?: SalesDashboardKpis;
  departments?: SalesGroupRow[];
  salespersons?: SalesGroupRow[];
  brands?: SalesGroupRow[];
  leakage?: { grossProfit: number; discount: number; cogs: number };
  health?: { good: string[]; bad: string[] };
  summary?: { lineItems: number; deptCount: number; spCount: number; brandCount: number; netRevenue: number; grossMarginPct: number; discRatePct: number; aov: number };
};

export const getSalesDashboard = (fromDt: string, toDt: string) =>
  client.get<SalesDashboardResponse>('/admin/sales-dashboard', { params: { fromDt, toDt } });
