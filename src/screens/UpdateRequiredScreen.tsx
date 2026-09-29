import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Linking, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '../theme';

type Props = {
  latestVersionName?: string;
  releaseNotes?: string | null;
  apkUrl?: string | null;
};

export default function UpdateRequiredScreen({ latestVersionName, releaseNotes, apkUrl }: Props) {
  const [opening, setOpening] = useState(false);

  const handleUpdate = async () => {
    if (!apkUrl) {
      Alert.alert('Update link unavailable', 'Please contact your admin for the latest app file.');
      return;
    }
    setOpening(true);
    try {
      await Linking.openURL(apkUrl);
    } catch {
      Alert.alert('Could not open link', 'Please contact your admin for the latest app file.');
    } finally {
      setOpening(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <View style={styles.iconCircle}>
          <Text style={styles.iconText}>↑</Text>
        </View>
        <Text style={styles.title}>Update Required</Text>
        <Text style={styles.subtitle}>
          {latestVersionName ? `A new version (${latestVersionName}) of Apna Payroll is available.` : 'A new version of Apna Payroll is available.'} You need to
          update before you can continue using the app.
        </Text>
        {!!releaseNotes && (
          <View style={styles.notesBox}>
            <Text style={styles.notesLabel}>What's new</Text>
            <Text style={styles.notesText}>{releaseNotes}</Text>
          </View>
        )}
        <Pressable style={styles.button} onPress={handleUpdate} disabled={opening}>
          {opening ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Update Now</Text>}
        </Pressable>
        <Text style={styles.hint}>The update will download in your browser. Once it finishes, open it to install.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: spacing(3) },
  card: { width: '100%', maxWidth: 420, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing(4), alignItems: 'center' },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing(2),
  },
  iconText: { color: '#fff', fontSize: 30, fontWeight: '800' },
  title: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: spacing(1) },
  subtitle: { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20, marginBottom: spacing(2) },
  notesBox: { width: '100%', backgroundColor: colors.background, borderRadius: radius.sm, padding: spacing(2), marginBottom: spacing(2) },
  notesLabel: { fontSize: 12, fontWeight: '700', color: colors.textMuted, marginBottom: 4, textTransform: 'uppercase' },
  notesText: { fontSize: 13, color: colors.text, lineHeight: 19 },
  button: { width: '100%', backgroundColor: colors.primary, borderRadius: radius.sm, paddingVertical: spacing(1.75), alignItems: 'center', marginTop: spacing(1) },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  hint: { fontSize: 12, color: colors.textMuted, textAlign: 'center', marginTop: spacing(2) },
});
