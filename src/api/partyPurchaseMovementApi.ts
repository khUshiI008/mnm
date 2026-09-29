import client from './client';

export type PurchaseMovementWindow = {
  label: string;
  opening: number;
  purchase: number;
  totalStock: number;
  sale: number;
  salePct: number;
  cumPurchase: number;
  cumSale: number;
  cumBalance: number;
  cumSalePct: number;
};

export type PurchaseMovementRow = {
  session: string;
  fromPurchase: string | null;
  windows: PurchaseMovementWindow[];
};

export type PurchaseMovementSessionUsed = { session: string; fromPurchase: string | null };

export type PurchaseMovementSummaryResponse = {
  success: boolean;
  notConfigured?: boolean;
  branchesNotFound?: boolean;
  message?: string;
  sessionsUsed: PurchaseMovementSessionUsed[];
  brandName?: string;
  asOf?: string;
  rows: PurchaseMovementRow[];
};

export const getPurchaseMovementSummary = (filters: { brandId?: number }, previewPartyId?: number) =>
  client.post<PurchaseMovementSummaryResponse>('/party/dashboard/purchase-movement', filters, previewPartyId ? { params: { previewPartyId } } : undefined);

export type PurchaseMovementDetailArticle = {
  articleNo: string;
  color: string;
  qty: number;
  rows: { reference: string; date: string | null; qty: number; branchId: string }[];
};
export type PurchaseMovementDetailCategory = { category: string; qty: number; articles: PurchaseMovementDetailArticle[] };
export type PurchaseMovementDetailDepartment = { department: string; qty: number; categories: PurchaseMovementDetailCategory[] };
export type PurchaseMovementDetailSection = {
  total: number;
  ghmQty: number;
  brsQty: number;
  branchTree: { ghm: PurchaseMovementDetailDepartment[]; brs: PurchaseMovementDetailDepartment[] };
};

export type PurchaseMovementDetailResponse = {
  success: boolean;
  message?: string;
  session: string;
  window: string;
  fromDate: string | null;
  toDate: string | null;
  purchase: PurchaseMovementDetailSection;
  sale: PurchaseMovementDetailSection;
};

export const getPurchaseMovementDetail = (filters: { brandId?: number; session: string; window: string }, previewPartyId?: number) =>
  client.post<PurchaseMovementDetailResponse>('/party/dashboard/purchase-movement/detail', filters, previewPartyId ? { params: { previewPartyId } } : undefined);
