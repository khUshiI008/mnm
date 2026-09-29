import client from './client';

export type ProfileResponse = {
  success: boolean;
  fullName: string;
  organizationName: string;
  employeeCode: string | null;
  mobile: string;
  email: string | null;
  gender: string | null;
  dateOfBirth: string | null;
  anniversaryDate: string | null;
  maritalStatus: string | null;
  dateOfJoining: string | null;
  lastLoginDate: string | null;
  department: string | null;
  designation: string | null;
  employmentType: string | null;
  portal: { mobile: string; email: string; isVerified: boolean; approvalStatus: string; since: string };
  kyc: {
    locked: boolean;
    submittedDate: string | null;
    profilePicturePath: string | null;
    aadharFrontPath: string | null;
    aadharBackPath: string | null;
    signaturePath: string | null;
    aadharNumberMasked: string | null;
    gender: string | null;
    dateOfBirth: string | null;
    maritalStatus: string | null;
    anniversaryDate: string | null;
    address: string | null;
    email: string | null;
    isEmailVerified: boolean;
    bankName: string | null;
    ifscCode: string | null;
    accountNo: string | null;
  } | null;
};

export const getProfile = () => client.get<ProfileResponse>('/profile');

export const sendEmailCode = (email: string) => client.post('/profile/email/send-code', { email });

export const verifyEmailCode = (code: string) => client.post('/profile/email/verify-code', { code });

export type KycPayload = {
  gender: string;
  dateOfBirth: string;
  maritalStatus?: string;
  anniversaryDate?: string;
  address?: string;
  bankName: string;
  ifscCode: string;
  accountNo: string;
  aadharNumber: string;
  email?: string;
  profilePicture: string;
  aadharFront: string;
  aadharBack: string;
  signature: string;
};

export const submitKyc = (payload: KycPayload) => client.post('/profile/kyc', payload);

export const updateContactDetails = (payload: { maritalStatus?: string; anniversaryDate?: string; address?: string }) =>
  client.post('/profile/contact-details', payload);
