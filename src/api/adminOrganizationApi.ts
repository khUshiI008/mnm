import client from './client';

export type OrganizationRow = {
  organizationId: number;
  organizationName: string;
  ministryDeptAffiliation: string;
  organizationType: string;
  companyName: string;
  legalName: string | null;
  companyCode: string | null;
  companyLogoPath: string | null;
  companyType: string | null;
  industryType: string | null;
  cinNumber: string | null;
  panNumber: string | null;
  tanNumber: string | null;
  gstin: string | null;
  msmeUdyamNumber: string | null;
  iecCode: string | null;
  addressLine1: string;
  addressLine2: string;
  landmark: string | null;
  stateUT: string;
  cityDistrict: string;
  country: string;
  pinCode: string;
  mobileNumber: string;
  alternateMobile: string | null;
  landlineNumber: string | null;
  emailId: string;
  websiteUrl: string | null;
  faxNumber: string | null;
  createdDate: string;
};

export type OrganizationMeta = {
  statesAndUTs: string[];
  organizationTypes: string[];
  companyTypes: string[];
  industryTypes: string[];
};

export type OrganizationPayload = {
  organizationName: string;
  ministryDeptAffiliation: string;
  organizationType: string;
  companyName: string;
  legalName?: string;
  companyCode?: string;
  companyType?: string;
  industryType?: string;
  cinNumber?: string;
  panNumber?: string;
  tanNumber?: string;
  gstin?: string;
  msmeUdyamNumber?: string;
  iecCode?: string;
  addressLine1: string;
  addressLine2: string;
  landmark?: string;
  stateUT: string;
  cityDistrict: string;
  country?: string;
  pinCode: string;
  mobileNumber: string;
  alternateMobile?: string;
  landlineNumber?: string;
  emailId: string;
  websiteUrl?: string;
  faxNumber?: string;
};

export const getOrganizationMeta = () => client.get<{ success: boolean } & OrganizationMeta>('/admin/organizations/meta');

export const getOrganizations = (search?: string) =>
  client.get<{ success: boolean; organizations: OrganizationRow[] }>('/admin/organizations', { params: search ? { search } : {} });

export const createOrganization = (payload: OrganizationPayload) =>
  client.post<{ success: boolean; organization: OrganizationRow; errors?: string[] }>('/admin/organizations', payload);

export const updateOrganization = (id: number, payload: OrganizationPayload) =>
  client.put<{ success: boolean; organization: OrganizationRow; errors?: string[] }>(`/admin/organizations/${id}`, payload);

export const deleteOrganization = (id: number) => client.delete<{ success: boolean }>(`/admin/organizations/${id}`);
