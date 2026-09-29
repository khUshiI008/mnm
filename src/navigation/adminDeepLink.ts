/**
 * "Navigate without the navigation prop" bridge for AdminShell.tsx's own
 * push/pop stack — mirrors navigationRef.ts's pattern, but that one only
 * reaches react-navigation route names (the employee side's actual
 * NavigationContainer). AdminShell keeps its own independent stack in plain
 * component state (see its own doc comment), so a notification-tap handler
 * firing from outside the React tree (App.tsx's messaging().onNotificationOpenedApp/
 * getInitialNotification, or a cold start) has no react-navigation route to
 * call into for admin screens — this fills that gap.
 *
 * AdminShell registers its own resetTo as the handler on mount. If a deep
 * link arrives before that registration has happened yet (e.g. a cold start
 * where the notification tap is processed before AdminShell has mounted),
 * it's queued and replayed the moment the handler registers.
 */
type DeepLinkHandler = (key: string, params?: object) => void;

let handler: DeepLinkHandler | null = null;
let queued: { key: string; params?: object } | null = null;

export function registerAdminDeepLinkHandler(fn: DeepLinkHandler) {
  handler = fn;
  if (queued) {
    const q = queued;
    queued = null;
    fn(q.key, q.params);
  }
}

export function unregisterAdminDeepLinkHandler() {
  handler = null;
}

export function navigateAdminDeepLink(key: string, params?: object) {
  if (handler) handler(key, params);
  else queued = { key, params };
}
