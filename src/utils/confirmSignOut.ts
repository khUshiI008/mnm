import { Alert } from 'react-native';

/** Shared confirm-before-signout prompt — used by both AdminTopbar and EmployeeStack's header. */
export function confirmSignOut(signOut: () => void) {
  Alert.alert('Sign out?', 'Are you sure you want to sign out?', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Sign Out', style: 'destructive', onPress: signOut },
  ]);
}
