import client from './client';

export type EmployeeBrandOption = { id: number; display: string };

export const getLiveStockBrands = () => client.get<{ success: boolean; brands: EmployeeBrandOption[] }>('/live-stock/brands');

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

export type LiveStockSummaryResponse = {
  success: boolean;
  notConfigured?: boolean;
  activeBrandId: number | null;
  brandOptions: EmployeeBrandOption[];
  asOf: string;
  periodFrom: string;
  periodTo: string;
  stock: MetricPayload | null;
  sold: MetricPayload | null;
  saleReturn: MetricPayload | null;
  sellThroughPct: number;
  saleReturnPct: number;
};

export type DrillFilters = {
  periodMode?: string;
  from?: string;
  to?: string;
  shift?: 'prev' | 'next';
  brandId?: number;
};

export const getLiveStockSummary = (filters: DrillFilters) => client.post<LiveStockSummaryResponse>('/live-stock/summary', filters);

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

export const getLiveStockDrillRows = (
  params: DrillFilters & { branch: 'brs' | 'ghm'; department: string; session: string; category: string; kind: 'stock' | 'sold' | 'salereturn' }
) => client.post<DrillRowsResponse>('/live-stock/drill-rows', params);

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

export const getLiveStockArticleBalance = (params: DrillFilters & { articleNo: string }) =>
  client.post<ArticleBalanceResponse>('/live-stock/article-balance', params);

export type FastMovingRow = {
  articleNo: string;
  color: string;
  fastMoving: number;
  alsoMoving: number;
  slowMoving: number;
  nonMoving: number;
  totalSold: number;
  availableQty: number;
  unresolvedQty: number;
  receivedQty: number;
  liveBalanceQty: number;
};

export type FastMovingResponse = {
  success: boolean;
  notConfigured: boolean;
  activeBrandId: number | null;
  brandOptions: EmployeeBrandOption[];
  asOf?: string;
  rows: FastMovingRow[];
};

export const getLiveStockFastMoving = (filters: { brandId?: number }) =>
  client.post<FastMovingResponse>('/live-stock/fast-moving', filters);
