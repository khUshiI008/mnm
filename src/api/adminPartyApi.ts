import client from './client';

export type PickerOption = { id: number; name: string };
export type ExtraDescriptionOption = { text: string; brandIds: number[] };

export type PartyGridItem = {
  partyId: number;
  mobileNo: string;
  email: string | null;
  isActive: boolean;
  brandNamesDisplay: string;
  deptNamesDisplay: string;
  supplierNamesDisplay: string;
  extraDescNamesDisplay: string;
  additionalMobiles: string[];
  brandCount: number;
  createdDate: string;
  createdBy: string | null;
  modifiedDate: string | null;
  modifiedBy: string | null;
};

export type PartyDetail = {
  partyId: number;
  mobileNo: string;
  email: string | null;
  isActive: boolean;
  brandIds: number[];
  departmentIds: number[];
  supplierIds: number[];
  additionalMobiles: string[];
  extraDescriptions: string[];
  fastMovingSessionIds: number[];
  currentSalePerfSessionIds: number[];
  purchaseMovingSessionIds: number[];
  createdDate: string;
  createdBy: string | null;
  modifiedDate: string | null;
  modifiedBy: string | null;
};

export type PartyPayload = {
  mobileNo: string;
  email?: string | null;
  additionalMobiles: string[];
  brandIds: number[];
  departmentIds: number[];
  supplierIds: number[];
  extraDescriptions: string[];
  fastMovingSessionIds: number[];
  currentSalePerfSessionIds: number[];
  purchaseMovingSessionIds: number[];
};

export const getParties = () => client.get<{ success: boolean; parties: PartyGridItem[] }>('/admin/party');

export const getPartyLookups = () =>
  client.get<{ success: boolean; brands: PickerOption[]; departments: PickerOption[]; suppliers: PickerOption[]; extraDescriptions: ExtraDescriptionOption[] }>(
    '/admin/party/lookups'
  );

export const getParty = (id: number) => client.get<{ success: boolean; party: PartyDetail }>(`/admin/party/${id}`);

export const checkPartyMobile = (mobile: string, partyId?: number) =>
  client.get<{ success: boolean; taken: boolean; partyLabel?: string }>('/admin/party/check-mobile', { params: { mobile, partyId } });

export const createParty = (payload: PartyPayload) =>
  client.post<{ success: boolean; partyId?: number; errors?: string[] }>('/admin/party', payload);

export const updateParty = (id: number, payload: PartyPayload) =>
  client.put<{ success: boolean; partyId?: number; errors?: string[] }>(`/admin/party/${id}`, payload);

export const togglePartyActive = (id: number, activate: boolean) =>
  client.put<{ success: boolean }>(`/admin/party/${id}/toggle-active`, { activate });

/** Hard delete — cascades every child junction (Brands/Departments/Suppliers/MobileNumbers/ExtraDescriptions/FastMovingSessions) server-side. Cannot be undone. */
export const deleteParty = (id: number) => client.delete<{ success: boolean }>(`/admin/party/${id}`);

export type FastMovingSessionOption = { name: string; flagged: boolean; fastMovingSessionId: number | null };

export const getFastMovingSessionOptions = () => client.get<{ success: boolean; sessions: FastMovingSessionOption[] }>('/admin/party/fast-moving-sessions');

export const setFastMovingSessions = (sessionValues: string[]) =>
  client.post<{ success: boolean; count: number }>('/admin/party/fast-moving-sessions', { sessionValues });

export type CurrentSalePerfSessionOption = { name: string; flagged: boolean; currentSalePerfSessionId: number | null };

export const getCurrentSalePerfSessionOptions = () =>
  client.get<{ success: boolean; sessions: CurrentSalePerfSessionOption[] }>('/admin/party/current-sale-perf-sessions');

export const setCurrentSalePerfSessions = (sessionValues: string[]) =>
  client.post<{ success: boolean; count: number }>('/admin/party/current-sale-perf-sessions', { sessionValues });

export type PurchaseMovingSessionOption = { name: string; flagged: boolean; purchaseMovingSessionId: number | null };

export const getPurchaseMovingSessionOptions = () =>
  client.get<{ success: boolean; sessions: PurchaseMovingSessionOption[] }>('/admin/party/purchase-moving-sessions');

export const setPurchaseMovingSessions = (sessionValues: string[]) =>
  client.post<{ success: boolean; count: number }>('/admin/party/purchase-moving-sessions', { sessionValues });
