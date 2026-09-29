import { createNavigationContainerRef } from '@react-navigation/native';

/**
 * Standard React Navigation "navigate without the navigation prop" pattern —
 * needed by anything that isn't itself a screen inside a navigator (e.g.
 * OverdueLoanAlert.tsx, rendered as a sibling of EmployeeStack's Tab.Navigator
 * rather than one of its screens, so it has no navigation prop of its own).
 */
// Untyped (no app-wide ParamList exists) — this helper is deliberately
// generic, callable with any top-level tab/screen name from anywhere in the
// app, not scoped to one navigator's own param list.
export const navigationRef = createNavigationContainerRef<any>();

export function navigate(name: string, params?: object) {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name, params);
  }
}
