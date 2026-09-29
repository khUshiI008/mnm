/**
 * Apna Payroll — React Native app
 * @format
 */

import React, { useEffect } from 'react';
import { StatusBar, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import messaging, { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { NotificationProvider, useNotifications } from './src/context/NotificationContext';
import RootNavigator from './src/navigation/RootNavigator';
import BirthdayModal from './src/components/BirthdayModal';
import AnniversaryModal from './src/components/AnniversaryModal';
import MorningGreetingModal from './src/components/MorningGreetingModal';
import FestivalGreetingModal from './src/components/FestivalGreetingModal';
import GurpurabVideoModal from './src/components/GurpurabVideoModal';
import AdminCelebrationModal from './src/components/AdminCelebrationModal';
import AppUpdateGate from './src/components/AppUpdateGate';
import { ensureChannels } from './src/notifications/channels';
import { requestNotificationPermission } from './src/notifications';
import { handleAdminNotificationTap } from './src/notifications/adminNotificationRouter';
import { handleEmployeeNotificationTap } from './src/notifications/employeeNotificationRouter';
import TargetRemarkModal from './src/components/TargetRemarkModal';

/** Needs to be inside both AuthProvider and NotificationProvider, so it's a child of App rather than inlined there. */
function BirthdayModalHost() {
  const { user } = useAuth();
  const { showBirthdayModal, dismissBirthdayModal } = useNotifications();
  return <BirthdayModal visible={showBirthdayModal} name={user?.name || 'there'} onClose={dismissBirthdayModal} />;
}

function AnniversaryModalHost() {
  const { user } = useAuth();
  const { showAnniversaryModal, dismissAnniversaryModal } = useNotifications();
  return <AnniversaryModal visible={showAnniversaryModal} name={user?.name || 'there'} onClose={dismissAnniversaryModal} />;
}

/**
 * Routes an OS-push-notification tap to the relevant screen/popup — both a
 * cold start (app was killed, tapping the notification launches it) via
 * getInitialNotification(), and a tap while merely backgrounded via
 * onNotificationOpenedApp(). The in-app bell list (NotificationsModal.tsx)
 * handles its own taps separately, but defers to the same
 * handleAdminNotificationTap()/handleEmployeeNotificationTap() so the
 * type->destination mapping only lives once per side.
 *
 * Needs to be inside AuthProvider for useAuth(), so (like the Birthday/
 * Anniversary modal hosts above) it's a sibling component rather than
 * inlined into App() directly.
 */
function NotificationTapHandler() {
  const { user } = useAuth();

  useEffect(() => {
    if (user?.mode !== 'admin' && user?.mode !== 'employee') return undefined;
    const mode = user.mode;

    const onOpen = (remoteMessage: FirebaseMessagingTypes.RemoteMessage | null) => {
      const type = remoteMessage?.data?.type as string | undefined;
      if (!type) return;
      const tapped = {
        type,
        title: remoteMessage?.notification?.title,
        body: remoteMessage?.notification?.body,
        data: remoteMessage?.data ?? null,
      };
      if (mode === 'admin') handleAdminNotificationTap(tapped);
      else handleEmployeeNotificationTap(tapped);
    };

    messaging().getInitialNotification().then(onOpen);
    return messaging().onNotificationOpenedApp(onOpen);
  }, [user?.mode]);

  return null;
}

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  useEffect(() => {
    ensureChannels().catch(() => {});
    requestNotificationPermission().catch(() => {});
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <AppUpdateGate>
        <AuthProvider>
          <NotificationProvider>
            <BirthdayModalHost />
            <AnniversaryModalHost />
            <NotificationTapHandler />
            <MorningGreetingModal />
            <FestivalGreetingModal />
            <GurpurabVideoModal />
            <AdminCelebrationModal />
            <TargetRemarkModal />
            <RootNavigator />
          </NotificationProvider>
        </AuthProvider>
      </AppUpdateGate>
    </SafeAreaProvider>
  );
}

export default App;
