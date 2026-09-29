import client from './client';

export type DrillCategoryNode = { label: string; qty: number };
export type DrillSessionNode = { label: string; qty: number; categories: DrillCategoryNode[] };
export type DrillDepartmentNode = { label: string; qty: number; sessions: DrillSessionNode[] };

export type MetricPayload = {
  totals: { brs: number; ghm: number; total: number };
  branchTree: {
    brs: { departments: DrillDepartmentNode[] } | null;
    ghm: { departments: DrillDepartmentNode[] } | null;
  };
};

export type BalanceStockSummaryResponse = {
  success: boolean;
  notConfigured?: boolean;
  activeBrandId: number | null;
  brandOptions: { id: number; name: string }[];
  asOf: string;
  periodFrom: string;
  periodTo: string;
  stock: MetricPayload | null;
  sold: MetricPayload | null;
  saleReturn: MetricPayload | null;
  sellThroughPct: number;
  saleReturnPct: number;
  scope: { displayName: string; hideBrandName: boolean };
};

export type DrillFilters = {
  periodMode?: string;
  from?: string;
  to?: string;
  shift?: 'prev' | 'next';
  brandId?: number;
  selCategories?: string[];
  selSizes?: string[];
  selColors?: string[];
};

export const getBalanceStockSummary = (filters: DrillFilters, previewPartyId?: number) =>
  client.post<BalanceStockSummaryResponse>('/party/dashboard/balance-stock-summary', filters, previewPartyId ? { params: { previewPartyId } } : undefined);

export type DrillLeafRow = { articleNo: string; barcode: string; size: string; color: string; qty: number };
export type DrillRowsResponse = {
  success: boolean;
  kind: 'stock' | 'sold' | 'salereturn';
  branch: 'brs' | 'ghm';
  branchLabel: string;
  department: string;
  session: string;
  category: string;
  asOf: string;
  totalQty: number;
  rows: DrillLeafRow[];
};

export const getBalanceStockDrillRows = (
  params: DrillFilters & { branch: 'brs' | 'ghm'; department: string; session: string; category: string; kind: 'stock' | 'sold' | 'salereturn' },
  previewPartyId?: number
) => client.post<DrillRowsResponse>('/party/dashboard/balance-stock-drill', params, previewPartyId ? { params: { previewPartyId } } : undefined);

export type ArticleSizeRow = { size: string; qty: number; brsQty: number; ghmQty: number };
export type ArticleColorRow = { color: string; qty: number; brsQty: number; ghmQty: number; sizes: ArticleSizeRow[] };
export type ArticleBalanceResponse = {
  success: boolean;
  articleNo: string;
  asOf: string;
  totalQty: number;
  totalBrsQty: number;
  totalGhmQty: number;
  colors: ArticleColorRow[];
};

export const getArticleBalance = (params: DrillFilters & { articleNo: string }, previewPartyId?: number) =>
  client.post<ArticleBalanceResponse>('/party/dashboard/article-balance', params, previewPartyId ? { params: { previewPartyId } } : undefined);
