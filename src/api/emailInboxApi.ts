import client from './client';

export type EmailFilter = 'important' | 'other' | 'all';

export type EmailRow = {
  monitoredEmailId: number;
  sourceAccount: string;
  senderName: string | null;
  senderEmail: string | null;
  subject: string | null;
  summary: string | null;
  receivedDate: string;
  isImportant: boolean;
  actionRequired: boolean;
  isRead: boolean;
};

export type EmailListResponse = {
  success: boolean;
  rows: EmailRow[];
  total: number;
  page: number;
  totalPages: number;
  unreadImportantCount: number;
};

export type EmailDetail = EmailRow & {
  bodySnippet: string | null;
  matchedKeywords: string[];
  importanceScore: number;
  gmailThreadId: string | null;
};

export const getEmailInboxList = (filter: EmailFilter = 'all', page = 0) =>
  client.get<EmailListResponse>('/email-inbox', { params: { filter, page, pageSize: 30 } });

export const getEmailInboxUnreadCount = () => client.get<{ success: boolean; unreadImportantCount: number }>('/email-inbox/unread-count');

export const getEmailInboxDetail = (id: number) => client.get<{ success: boolean } & EmailDetail>(`/email-inbox/${id}`);

export const markEmailRead = (id: number, isRead = true) => client.post<{ success: boolean }>(`/email-inbox/${id}/read`, { isRead });
