import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../../theme';

/**
 * Shown whenever the backend returns 403/TRIAL_PENDING — mirrors
 * EmployeeAccess.RedirectIfTrial in the .NET app, which bounces every
 * employee page except Profile back to Profile while the account awaits
 * HR approval.
 */
export default function TrialGate({ navigation }: any) {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Pending approval</Text>
      <Text style={styles.body}>
        Your account is awaiting HR approval. Complete your Profile below — attendance, leave and salary features unlock
        once approved.
      </Text>
      <Text style={styles.link} onPress={() => navigation.navigate('Profile')}>
        Go to Profile
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, padding: spacing(3), alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: spacing(1) },
  body: { color: colors.textMuted, textAlign: 'center', marginBottom: spacing(2) },
  link: { color: colors.primary, fontWeight: '700' },
});
