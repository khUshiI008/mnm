import client from './client';

export type PermissionGrant = { moduleKey: string; actionKey: string; allowedFields: string[] | null };

export type AuthUser = {
  mode: 'employee' | 'admin' | 'party';
  empUserId?: number;
  /** Party-mode only — the logged-in Party's id (Panel/Settings/PartyPanel-created record). */
  partyId?: number;
  name: string;
  approvalStatus?: string | null;
  /** Manager grants for this employee, fetched separately after login/app-restore — see AuthContext. */
  permissions?: PermissionGrant[];
  /** Admin-mode only — the mobile number logged in with. Used to scope per-admin local state (e.g. MorningGreetingModal's "already shown today" flag) so different admins testing on the same device don't share state. */
  mobile?: string;
  /** Admin-mode only — true for exactly one designated admin mobile (config/env.js's specialAdminMobile on the backend). Gates the Settings > Quotes management screen only — every admin gets the shayari morning greeting itself. */
  isSpecialAdmin?: boolean;
};

export const sendOtp = (mobile: string) => client.post('/auth/send-otp', { mobile });

export const verifyOtp = (mobile: string, otp: string) =>
  client.post<{ success: boolean; token?: string; user?: AuthUser; message?: string; alreadyLoggedIn?: boolean }>('/auth/verify-otp', {
    mobile,
    otp,
  });

/** Completes a login blocked by verifyOtp's alreadyLoggedIn response — signs out the other device and continues here. */
export const forceLogin = (mobile: string) =>
  client.post<{ success: boolean; token?: string; user?: AuthUser; message?: string }>('/auth/force-login', { mobile });

export const resendOtp = (mobile: string) => client.post('/auth/resend-otp', { mobile });

export type RegistrationOrganization = { OrganizationId: number; OrganizationName: string };
export type RegistrationLocation = { LocationId: number; LocationName: string; OrganizationId: number };
export type RegistrationDepartment = { lookupId: number; name: string };

export const getRegistrationOptions = () =>
  client.get<{
    success: boolean;
    organizations: RegistrationOrganization[];
    locations: RegistrationLocation[];
    departments: RegistrationDepartment[];
  }>('/auth/registration-options');

export type RegistrationPayload = {
  fullName: string;
  attendanceCode: string;
  mobile: string;
  email: string;
  gender: string;
  dateOfBirth?: string;
  organizationId: number;
  locationId: number;
  maritalStatus: string;
  departmentLookupId: number;
  dateOfJoining: string;
  bankName: string;
  ifscCode: string;
  accountNo: string;
};

export const startRegistration = (payload: RegistrationPayload) => client.post('/auth/register/start', payload);

export const verifyRegistration = (mobile: string, otp: string) =>
  client.post('/auth/register/verify', { mobile, otp });
