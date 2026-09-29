import client from './client';

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
  brandOptions: { id: number; name: string }[];
  asOf?: string;
  rows: FastMovingRow[];
};

export const getFastMovingProducts = (filters: { brandId?: number }, previewPartyId?: number) =>
  client.post<FastMovingResponse>('/party/dashboard/fast-moving', filters, previewPartyId ? { params: { previewPartyId } } : undefined);
