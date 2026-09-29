import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Button from '../../components/Button';
import { colors, radius, spacing } from '../../theme';
import { useAdminNav } from '../../navigation/AdminShell';
import { getPurchaseMovingSessionOptions, setPurchaseMovingSessions } from '../../api/adminPartyApi';

const A = colors.admin;

/**
 * Node port of Panel/Settings/PartyPanel/Index.aspx's "Set Purchase Moving
 * Session Article" button — a whole-system (not Party-scoped) flag list,
 * sibling feature to Fast Moving Sessions / Current Sale Performance
 * Sessions (see FastMovingSessionsScreen.tsx / CurrentSalePerfSessionsScreen.tsx)
 * on the same page — same shape, different feature. Read by
 * partyPurchaseMovementService.js's Purchase Movement cohort running-balance
 * calculation. Unselecting a session and saving removes its flag entirely
 * (wholesale replace), matching the .NET behavior exactly.
 */
export default function PurchaseMovingSessionsScreen() {
  const { goBack } = useAdminNav();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sessions, setSessions] = useState<{ name: string; flagged: boolean }[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getPurchaseMovingSessionOptions();
      setSessions(res.data.sessions);
    } catch {
      Alert.alert('Could not load sessions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = (name: string) => {
    setSessions((prev) => prev.map((s) => (s.name === name ? { ...s, flagged: !s.flagged } : s)));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const values = sessions.filter((s) => s.flagged).map((s) => s.name);
      await setPurchaseMovingSessions(values);
      Alert.alert('Saved', `${values.length} session(s) flagged for Purchase Moving.`);
      goBack();
    } catch {
      Alert.alert('Could not save', 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={A.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.hint}>
        Sessions checked here are flagged system-wide for Purchase Moving — the same for every Party unless a Party sets its own override on
        its Add/Edit screen.
      </Text>
      {sessions.length === 0 ? (
        <Text style={styles.emptyText}>No active Sessions found.</Text>
      ) : (
        sessions.map((s) => (
          <Pressable key={s.name} style={styles.row} onPress={() => toggle(s.name)}>
            <View style={[styles.checkbox, s.flagged && styles.checkboxChecked]}>{s.flagged && <Text style={styles.checkmark}>✓</Text>}</View>
            <Text style={styles.rowText}>{s.name}</Text>
          </Pressable>
        ))
      )}

      <Button title="Save" onPress={handleSave} loading={saving} style={{ marginTop: spacing(2) }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: A.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: A.bg },
  content: { padding: spacing(2), paddingBottom: spacing(5) },
  hint: { fontSize: 12, color: A.muted, marginBottom: spacing(2), lineHeight: 17 },
  emptyText: { color: A.muted, fontSize: 13, textAlign: 'center', marginTop: spacing(2) },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: A.border },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: A.border, alignItems: 'center', justifyContent: 'center', backgroundColor: A.surface },
  checkboxChecked: { backgroundColor: A.primary, borderColor: A.primary },
  checkmark: { color: '#fff', fontSize: 13, fontWeight: '800' },
  rowText: { fontSize: 13.5, color: A.ink, fontWeight: '600' },
});
