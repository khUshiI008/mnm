import client from './client';

export type AppNotification = {
  notificationId: number;
  type: 'LeaveApplied' | 'TargetCompleted' | 'Birthday' | 'Anniversary' | string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  isRead: boolean;
  createdDate: string;
};

export const getNotifications = () =>
  client.get<{
    success: boolean;
    unreadCount: number;
    isBirthdayToday: boolean;
    isAnniversaryToday: boolean;
    notifications: AppNotification[];
  }>('/notifications');

export const markNotificationRead = (id: number) => client.post<{ success: boolean }>(`/notifications/${id}/read`);

export const markAllNotificationsRead = () => client.post<{ success: boolean }>('/notifications/read-all');

export const clearAllNotifications = () => client.post<{ success: boolean }>('/notifications/clear-all');

export const registerDeviceToken = (token: string, platform: string = 'android') =>
  client.post<{ success: boolean }>('/notifications/device-token', { token, platform });

export const unregisterDeviceToken = (token: string) =>
  client.delete<{ success: boolean }>('/notifications/device-token', { data: { token } });
