import client from './client';

export type SalesMasterDataEntity = 'categories' | 'brands' | 'departments' | 'branches' | 'suppliers' | 'sessions' | 'salespersons';

export type SalesMasterDataItem = {
  id: string;
  name: string;
  displayName: string | null;
  shortName?: string | null;
  departmentName?: string;
  isRawMaterial?: boolean;
  hsnCode?: string | null;
  isWarehouse?: boolean;
  isOnline?: boolean;
  city?: string | null;
  activeStatus: boolean;
  lastSyncedOn: string | null;
};

export type SyncResult = { success: boolean; totalFromApi?: number; added?: number; updated?: number; message?: string };

export const getSalesMasterData = (entity: SalesMasterDataEntity, search?: string) =>
  client.get<{ success: boolean; entity: string; count: number; items: SalesMasterDataItem[] }>(`/admin/sales/master-data/${entity}`, {
    params: search ? { search } : {},
  });

export const syncSalesMasterData = (entity: SalesMasterDataEntity) =>
  client.post<SyncResult>(`/admin/sales/master-data/${entity}/sync`, undefined, { timeout: 90000 });

export const syncAllSalesMasterData = () =>
  client.post<{ success: boolean; results: Record<string, SyncResult> }>('/admin/sales/master-data/sync-all', undefined, { timeout: 180000 });
