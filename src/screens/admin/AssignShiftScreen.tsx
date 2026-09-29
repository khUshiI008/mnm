import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import Card from '../../components/Card';
import Button from '../../components/Button';
import TextField from '../../components/TextField';
import DateField from '../../components/DateField';
import SearchableSelect from '../../components/common/SearchableSelect';
import { colors, radius, spacing } from '../../theme';
import { usePermission } from '../../hooks/usePermission';
import { assignEmployeeShift, getShiftAssignmentHistory, getShiftDropdown, ShiftAssignmentHistoryItem, ShiftDropdownOption } from '../../api/adminShiftApi';

const A = colors.admin;

/** Mirrors Panel/Employees/Index.aspx's Shift Assignment drawer. */
export default function AssignShiftScreen({ params }: { params?: { employeeId?: number; employeeName?: string } }) {
  const employeeId = params?.employeeId;
  const canAssign = usePermission('Employee', 'Edit');

  const [shifts, setShifts] = useState<ShiftDropdownOption[]>([]);
  const [history, setHistory] = useState<ShiftAssignmentHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [shiftId, setShiftId] = useState(0);
  const [effectiveFrom, setEffectiveFrom] = useState('');

  const load = useCallback(async () => {
    if (!employeeId) return;
    setLoading(true);
    try {
      const [shiftRes, historyRes] = await Promise.all([getShiftDropdown(), getShiftAssignmentHistory(employeeId)]);
      setShifts(shiftRes.data.shifts);
      setHistory(historyRes.data.history);
    } catch {
      Alert.alert('Could not load shift data');
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    load();
  }, [load]);

  const current = history.find((h) => h.isCurrent);

  const handleSave = async () => {
    if (!employeeId) return;
    if (!shiftId) return Alert.alert('Please select a shift.');
    if (!effectiveFrom) return Alert.alert('Please enter an effective date.');

    setSaving(true);
    try {
      const res = await assignEmployeeShift(employeeId, { shiftId, effectiveFrom });
      Alert.alert('Shift assigned', res.data.message);
      setShiftId(0);
      setEffectiveFrom('');
      await load();
    } catch (err: any) {
      Alert.alert('Could not assign shift', err?.response?.data?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!employeeId) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>No employee selected.</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={A.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {!!params?.employeeName && <Text style={styles.empName}>{params.employeeName}</Text>}

      <Card style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Current Shift</Text>
        {current ? (
          <Text style={styles.currentShift}>{current.shiftLabel}</Text>
        ) : (
          <Text style={styles.emptyText}>No shift assigned yet.</Text>
        )}
      </Card>

      {canAssign && (
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>New Assignment</Text>
          <Text style={styles.label}>Shift *</Text>
          <SearchableSelect
            selectedValue={shiftId}
            onValueChange={(v) => setShiftId(Number(v))}
            items={shifts.map((s) => ({ label: s.label, value: s.shiftId }))}
            placeholder="-- Select Shift --"
            searchPlaceholder="Search shift"
            title="Select Shift"
          />
          <DateField label="Effective From *" granularity="day" value={effectiveFrom} onChange={setEffectiveFrom} placeholder="Select date" />
          <Button title="Assign Shift" onPress={handleSave} loading={saving} style={{ marginTop: spacing(1) }} />
        </Card>
      )}

      <Card style={[styles.sectionCard, { marginBottom: 0 }]}>
        <Text style={styles.sectionTitle}>Assignment History</Text>
        {history.length === 0 ? (
          <Text style={styles.emptyText}>No assignment history yet.</Text>
        ) : (
          history.map((h) => (
            <View key={h.assignmentId} style={styles.historyRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.historyShift}>{h.shiftLabel}</Text>
                <Text style={styles.historyDates}>
                  {h.effectiveFromDisplay} – {h.effectiveToDisplay || 'Present'}
                </Text>
                <Text style={styles.historyMeta}>
                  Assigned by {h.assignedBy} on {h.assignedAtDisplay}
                </Text>
              </View>
              {h.isCurrent && (
                <View style={styles.currentBadge}>
                  <Text style={styles.currentBadgeText}>Current</Text>
                </View>
              )}
            </View>
          ))
        )}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: A.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: A.bg },
  content: { padding: spacing(2), paddingBottom: spacing(5) },
  empName: { fontSize: 16, fontWeight: '800', color: A.ink, marginBottom: spacing(1.5) },
  sectionCard: { marginBottom: spacing(2), borderRadius: radius.md },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: A.ink, marginBottom: spacing(1.5) },
  label: { fontSize: 13, color: A.muted, marginBottom: 6, fontWeight: '500' },
  pickerWrap: { borderWidth: 1, borderColor: A.border, borderRadius: radius.sm, marginBottom: 16, backgroundColor: A.surface },
  currentShift: { fontSize: 14, color: A.ink, fontWeight: '600' },
  emptyText: { color: A.muted, fontSize: 13 },

  historyRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 10, borderTopWidth: 1, borderTopColor: A.border },
  historyShift: { fontSize: 13, fontWeight: '700', color: A.ink },
  historyDates: { fontSize: 12, color: A.muted, marginTop: 2 },
  historyMeta: { fontSize: 11, color: A.muted, marginTop: 2 },
  currentBadge: { backgroundColor: '#15803d20', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, marginLeft: 8 },
  currentBadgeText: { color: '#15803d', fontSize: 11, fontWeight: '700' },
});
