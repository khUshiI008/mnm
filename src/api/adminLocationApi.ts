import client from './client';

export type LocationRow = {
  locationId: number;
  organizationId: number;
  organizationName: string;
  locationName: string;
  locationCode: string;
  addressLine1: string;
  addressLine2: string | null;
  contactPerson: string;
  contactNo: string;
  remarks: string | null;
  createdDate: string;
};

export type LocationOrgOption = { organizationId: number; organizationName: string };

export type LocationPayload = {
  organizationId: number;
  locationName: string;
  locationCode: string;
  addressLine1: string;
  addressLine2?: string;
  contactPerson: string;
  contactNo: string;
  remarks?: string;
};

export const getLocationOrganizationOptions = () =>
  client.get<{ success: boolean; organizations: LocationOrgOption[] }>('/admin/locations/organization-options');

export const getLocations = (search?: string) =>
  client.get<{ success: boolean; locations: LocationRow[] }>('/admin/locations', { params: search ? { search } : {} });

export const createLocation = (payload: LocationPayload) =>
  client.post<{ success: boolean; location: LocationRow; errors?: string[] }>('/admin/locations', payload);

export const updateLocation = (id: number, payload: LocationPayload) =>
  client.put<{ success: boolean; location: LocationRow; errors?: string[] }>(`/admin/locations/${id}`, payload);

export const deleteLocation = (id: number) => client.delete<{ success: boolean }>(`/admin/locations/${id}`);
