import client from './client';

export const getPendingLeaveFlag = () =>
  client.get<{ success: boolean; hasPendingLeaveApprovals: boolean }>('/admin/shell/pending-leave-flag');
