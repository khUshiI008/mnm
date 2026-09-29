import React, { createContext, useContext, useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import { connectSocket, disconnectSocket } from '../sockets/socketClient';
import { getNotifications, markNotificationRead, markAllNotificationsRead, clearAllNotifications, AppNotification } from '../api/notificationsApi';
import { registerForegroundHandler, displayBirthdayNotification, displayAnniversaryNotification } from '../notifications';
import { showTargetRemarkFromNotification } from '../components/TargetRemarkModal';

type NotificationContextValue = {
  notifications: AppNotification[];
  unreadCount: number;
  refresh: () => Promise<void>;
  markRead: (id: number) => Promise<void>;
  markAllRead: () => Promise<void>;
  clearAll: () => Promise<void>;
  showBirthdayModal: boolean;
  dismissBirthdayModal: () => void;
  showAnniversaryModal: boolean;
  dismissAnniversaryModal: () => void;
};

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

const BIRTHDAY_TITLE = 'Happy Birthday!';
const birthdayBody = (name: string) => `Apna Payroll app aur poori team ki taraf se, ${name}, aapko bahut bahut janamdin mubarak ho!`;

const ANNIVERSARY_TITLE = 'Happy Anniversary!';
const anniversaryBody = (name: string) => `Apna Payroll app aur poori team ki taraf se, ${name}, aapko shaadi ki saalgirah bahut bahut mubarak ho!`;

// Unlike birthday (deliberately re-fires every app open), anniversary is
// throttled — persisted so it survives a cold restart, not just an
// in-memory ref — so opening the app repeatedly through the day doesn't
// replay the sound/popup back to back. The 4 fixed server-side pushes
// (midnight/10am/3pm/8pm) already cover the day; this just adds "and also
// whenever they happen to open the app" without spamming.
const ANNIVERSARY_LAST_SHOWN_KEY = 'apna_payroll_last_anniversary_celebration';
const ANNIVERSARY_THROTTLE_MS = 2 * 60 * 60 * 1000; // 2 hours

/**
 * Owns the notification bell's data for both Admin and Employee (the backend
 * scopes GET /notifications by JWT identity, so one provider/one bell works
 * for both — see notificationController.js's scopeWhere). Live updates come
 * from two places: the shared Socket.io connection's `notification:new`
 * event (see backend/src/sockets/index.js) while the app is foregrounded,
 * and an FCM foreground message re-triggering the same refresh.
 *
 * Also owns the birthday celebration: unlike every other notification type,
 * it's deliberately NOT deduped — it's meant to re-fire every time the app
 * is opened/foregrounded on the employee's own birthday (see
 * backend/src/services/birthdayService.js's comment for the split between
 * this client-driven path and the two server-scheduled pushes).
 */
export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user, token } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showBirthdayModal, setShowBirthdayModal] = useState(false);
  const [showAnniversaryModal, setShowAnniversaryModal] = useState(false);
  const lastCelebratedRef = useRef(0);

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      const res = await getNotifications();
      setNotifications(res.data.notifications);
      setUnreadCount(res.data.unreadCount);
    } catch {
      /* best-effort — bell just keeps its last known state this cycle */
    }
  }, [token]);

  /** Same fetch as refresh(), plus the birthday check — kept separate so routine bell refreshes (mark-read, incoming leave/target notifications) never trigger the celebration, only genuine app-open events do. */
  const checkIn = useCallback(async () => {
    if (!token) return;
    try {
      const res = await getNotifications();
      setNotifications(res.data.notifications);
      setUnreadCount(res.data.unreadCount);

      if (res.data.isBirthdayToday) {
        const now = Date.now();
        // Guards against the mount-effect and the AppState 'active' event
        // both firing within the same cold start — a real re-open is always
        // seconds-to-minutes later, well past this window.
        if (now - lastCelebratedRef.current > 3000) {
          lastCelebratedRef.current = now;
          const name = user?.name || 'there';
          displayBirthdayNotification(BIRTHDAY_TITLE, birthdayBody(name)).catch(() => {});
          setShowBirthdayModal(true);
        }
      }

      if (res.data.isAnniversaryToday) {
        const now = Date.now();
        const lastShown = parseInt((await AsyncStorage.getItem(ANNIVERSARY_LAST_SHOWN_KEY)) || '0', 10);
        if (now - lastShown > ANNIVERSARY_THROTTLE_MS) {
          await AsyncStorage.setItem(ANNIVERSARY_LAST_SHOWN_KEY, String(now));
          const name = user?.name || 'there';
          displayAnniversaryNotification(ANNIVERSARY_TITLE, anniversaryBody(name)).catch(() => {});
          setShowAnniversaryModal(true);
        }
      }
    } catch {
      /* best-effort */
    }
  }, [token, user]);

  useEffect(() => {
    if (!user || !token) {
      setNotifications([]);
      setUnreadCount(0);
      disconnectSocket();
      return;
    }

    checkIn();

    const socket = connectSocket(token);
    const onNew = (payload: { type?: string; title?: string; body?: string }) => {
      refresh();
      // Live in-app popup for an admin's target-achievement remark, so an
      // employee already sitting in the app sees it immediately rather than
      // only on their next notification tap — see TargetRemarkModal.tsx.
      if (user?.mode === 'employee' && payload?.type === 'TargetRemarks' && payload.title && payload.body) {
        showTargetRemarkFromNotification({ title: payload.title, body: payload.body });
      }
    };
    socket.on('notification:new', onNew);
    const unsubscribeForeground = registerForegroundHandler(() => refresh());

    return () => {
      socket.off('notification:new', onNew);
      unsubscribeForeground();
    };
  }, [user, token, refresh, checkIn]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkIn();
    });
    return () => sub.remove();
  }, [checkIn]);

  const markRead = useCallback(
    async (id: number) => {
      await markNotificationRead(id);
      await refresh();
    },
    [refresh]
  );

  const markAllRead = useCallback(async () => {
    await markAllNotificationsRead();
    await refresh();
  }, [refresh]);

  const clearAll = useCallback(async () => {
    await clearAllNotifications();
    await refresh();
  }, [refresh]);

  const dismissBirthdayModal = useCallback(() => setShowBirthdayModal(false), []);
  const dismissAnniversaryModal = useCallback(() => setShowAnniversaryModal(false), []);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        refresh,
        markRead,
        markAllRead,
        clearAll,
        showBirthdayModal,
        dismissBirthdayModal,
        showAnniversaryModal,
        dismissAnniversaryModal,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
}
