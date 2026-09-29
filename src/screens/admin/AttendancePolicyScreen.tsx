import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Button from '../../components/Button';
import TextField from '../../components/TextField';
import DateField from '../../components/DateField';
import { colors, radius, shadow, spacing } from '../../theme';
import {
  AttendancePolicyPayload,
  AttendancePolicyRow,
  createAttendancePolicy,
  deleteAttendancePolicy,
  getAttendancePolicies,
  updateAttendancePolicy,
} from '../../api/adminAttendancePolicyApi';

const A = colors.admin;

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function AttendancePolicyScreen() {
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<AttendancePolicyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [formTarget, setFormTarget] = useState<{ row?: AttendancePolicyRow } | null>(null);

  const load = useCallback(async (term?: string) => {
    setLoading(true);
    try {
      const res = await getAttendancePolicies(term);
      setRows(res.data.policies);
    } catch {
      Alert.alert('Could not load attendance policies');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = (row: AttendancePolicyRow) => {
    Alert.alert('Archive this policy?', `${row.policyName} will be archived and hidden from active lists.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Archive',
        style: 'destructive',
        onPress: async () => {
          setBusyId(row.attendancePolicyId);
          try {
            await deleteAttendancePolicy(row.attendancePolicyId);
            await load(search || undefined);
          } catch (err: any) {
            Alert.alert('Could not archive', err?.response?.data?.message || 'Please try again.');
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.screen}>
      <View style={styles.topRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search policy name..."
          placeholderTextColor={A.muted}
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={() => load(search || undefined)}
          returnKeyType="search"
        />
        <Pressable style={styles.addBtn} onPress={() => setFormTarget({})}>
          <Text style={styles.addBtnText}>+ Add</Text>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={A.primary} style={styles.loader} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.countText}>{rows.length} policies</Text>
          {rows.length === 0 ? (
            <Text style={styles.emptyText}>No attendance policies found. Tap Add to create the first one.</Text>
          ) : (
            rows.map((row) => (
              <View key={row.attendancePolicyId} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{row.policyName}</Text>
                    <Text style={styles.sub}>Effective {row.effectiveFromDisplay}</Text>
                  </View>
                  {row.isCurrent && (
                    <View style={styles.currentBadge}>
                      <Text style={styles.currentBadgeText}>Current</Text>
                    </View>
                  )}
                </View>

                <Text style={styles.detailLine}>
                  Full Day ≥ {row.fullDayMinimumMinutes}m · Half Day ≥ {row.halfDayMinimumMinutes}m ({row.halfDayDeductionPercent}% deduction)
                </Text>
                <Text style={styles.detailLine}>
                  Tiers: 0–{row.absentT1Max} grace · {row.absentT1Max + 1}–{row.absentT2Max} std · {row.absentT2Max + 1}–{row.absentT3Max} (−{row.absentT3Grace}, {row.absentT3PLConsumed} PL) · {row.absentT3Max + 1}–{row.absentT4Count} (−{row.absentT4DeductDays}, {row.absentT4PLConsumed} PL) · {'>'}{row.absentT4Count} full
                </Text>

                <View style={styles.actionsRow}>
                  <Pressable style={[styles.actionBtn, styles.editBtn]} onPress={() => setFormTarget({ row })}>
                    <Text style={styles.editText}>Edit</Text>
                  </Pressable>
                  <Pressable style={[styles.actionBtn, styles.deleteBtn]} onPress={() => handleDelete(row)} disabled={busyId === row.attendancePolicyId}>
                    {busyId === row.attendancePolicyId ? <ActivityIndicator size="small" color="#b91c1c" /> : <Text style={styles.deleteText}>Archive</Text>}
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {formTarget && (
        <PolicyFormModal
          row={formTarget.row}
          onClose={() => setFormTarget(null)}
          onSaved={() => {
            setFormTarget(null);
            load(search || undefined);
          }}
        />
      )}
    </View>
  );
}

function PolicyFormModal({ row, onClose, onSaved }: { row?: AttendancePolicyRow; onClose: () => void; onSaved: () => void }) {
  const insets = useSafeAreaInsets();
  const isEdit = !!row;
  const [policyName, setPolicyName] = useState(row?.policyName || '');
  const [effectiveFrom, setEffectiveFrom] = useState(row?.effectiveFrom?.slice(0, 10) || todayIso());
  const [isCurrent, setIsCurrent] = useState(row?.isCurrent ?? false);

  const [fullDayMinimumMinutes, setFullDayMinimumMinutes] = useState(String(row?.fullDayMinimumMinutes ?? 360));
  const [halfDayMinimumMinutes, setHalfDayMinimumMinutes] = useState(String(row?.halfDayMinimumMinutes ?? 210));
  const [halfDayDeductionPercent, setHalfDayDeductionPercent] = useState(String(row?.halfDayDeductionPercent ?? 50));

  const [absentT1Max, setAbsentT1Max] = useState(String(row?.absentT1Max ?? 4));
  const [absentT2Max, setAbsentT2Max] = useState(String(row?.absentT2Max ?? 9));
  const [absentT3Max, setAbsentT3Max] = useState(String(row?.absentT3Max ?? 14));
  const [absentT3Grace, setAbsentT3Grace] = useState(String(row?.absentT3Grace ?? 3));
  const [absentT3PLConsumed, setAbsentT3PLConsumed] = useState(String(row?.absentT3PLConsumed ?? 1));
  const [absentT4Count, setAbsentT4Count] = useState(String(row?.absentT4Count ?? 15));
  const [absentT4DeductDays, setAbsentT4DeductDays] = useState(String(row?.absentT4DeductDays ?? 13));
  const [absentT4PLConsumed, setAbsentT4PLConsumed] = useState(String(row?.absentT4PLConsumed ?? 2));

  const [saving, setSaving] = useState(false);

  const save = async () => {
    const payload: AttendancePolicyPayload = {
      policyName,
      effectiveFrom,
      fullDayMinimumMinutes: Number(fullDayMinimumMinutes),
      halfDayMinimumMinutes: Number(halfDayMinimumMinutes),
      halfDayDeductionPercent: Number(halfDayDeductionPercent),
      isCurrent,
      absentT1Max: Number(absentT1Max),
      absentT2Max: Number(absentT2Max),
      absentT3Max: Number(absentT3Max),
      absentT3Grace: Number(absentT3Grace),
      absentT3PLConsumed: Number(absentT3PLConsumed),
      absentT4Count: Number(absentT4Count),
      absentT4DeductDays: Number(absentT4DeductDays),
      absentT4PLConsumed: Number(absentT4PLConsumed),
    };

    setSaving(true);
    try {
      if (isEdit) await updateAttendancePolicy(row!.attendancePolicyId, payload);
      else await createAttendancePolicy(payload);
      Alert.alert('Saved', `Attendance policy ${isEdit ? 'updated' : 'created'} successfully.`);
      onSaved();
    } catch (err: any) {
      const errors: string[] | undefined = err?.response?.data?.errors;
      Alert.alert('Could not save', errors?.join(' ') || err?.response?.data?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={[styles.modalBox, { paddingBottom: spacing(2.5) + insets.bottom }]} onPress={(e) => e.stopPropagation()}>
          <ScrollView>
            <Text style={styles.modalTitle}>{isEdit ? 'Edit Policy' : 'Add Policy'}</Text>

            <TextField label="Policy Name *" value={policyName} onChangeText={setPolicyName} />
            <DateField label="Effective From *" granularity="day" value={effectiveFrom} onChange={setEffectiveFrom} placeholder="Select date" />

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Set as Current Policy</Text>
              <Switch value={isCurrent} onValueChange={setIsCurrent} trackColor={{ true: A.primary }} />
            </View>

            <Text style={styles.sectionTitle}>Attendance / Half-Day Rules</Text>
            <TextField label="Full Day Minimum (min, 1-1440) *" value={fullDayMinimumMinutes} onChangeText={setFullDayMinimumMinutes} keyboardType="number-pad" />
            <TextField label="Half Day Minimum (min, 0-1440) *" value={halfDayMinimumMinutes} onChangeText={setHalfDayMinimumMinutes} keyboardType="number-pad" />
            <TextField label="Half Day Deduction (%, 0-100) *" value={halfDayDeductionPercent} onChangeText={setHalfDayDeductionPercent} keyboardType="number-pad" />

            <Text style={styles.sectionTitle}>Absent Tier Rules</Text>
            <TextField label="Tier 1 Grace Max (0-31) *" value={absentT1Max} onChangeText={setAbsentT1Max} keyboardType="number-pad" />
            <TextField label="Tier 2 Upper Bound (1-31) *" value={absentT2Max} onChangeText={setAbsentT2Max} keyboardType="number-pad" />
            <TextField label="Tier 3 Upper Bound (1-31) *" value={absentT3Max} onChangeText={setAbsentT3Max} keyboardType="number-pad" />
            <TextField label="Tier 3 Grace Offset (0-31) *" value={absentT3Grace} onChangeText={setAbsentT3Grace} keyboardType="number-pad" />
            <TextField label="Tier 3 PL Consumed (0-10) *" value={absentT3PLConsumed} onChangeText={setAbsentT3PLConsumed} keyboardType="number-pad" />
            <TextField label="Tier 4 Upper Bound (1-31) *" value={absentT4Count} onChangeText={setAbsentT4Count} keyboardType="number-pad" />
            <TextField label="Tier 4 Days Deducted (0-31) *" value={absentT4DeductDays} onChangeText={setAbsentT4DeductDays} keyboardType="number-pad" />
            <TextField label="Tier 4 PL Consumed (0-10) *" value={absentT4PLConsumed} onChangeText={setAbsentT4PLConsumed} keyboardType="number-pad" />

            <View style={styles.modalActions}>
              <Button title="Cancel" variant="outline" onPress={onClose} style={{ flex: 1 }} />
              <Button title={isEdit ? 'Save Changes' : 'Create'} onPress={save} loading={saving} style={{ flex: 1 }} />
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: A.bg },
  loader: { marginTop: spacing(4) },
  content: { padding: spacing(2) },
  topRow: { flexDirection: 'row', gap: 8, padding: spacing(2), paddingBottom: 0 },
  searchInput: { flex: 1, height: 42, borderWidth: 1, borderColor: A.border, borderRadius: radius.sm, backgroundColor: A.surface, paddingHorizontal: 12, color: A.ink, fontSize: 13 },
  addBtn: { height: 42, paddingHorizontal: 16, borderRadius: radius.sm, backgroundColor: A.primary, alignItems: 'center', justifyContent: 'center' },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  countText: { color: A.muted, fontSize: 12, marginBottom: spacing(1.5) },
  emptyText: { color: A.muted, fontSize: 13, textAlign: 'center', marginTop: spacing(4) },

  card: { backgroundColor: A.surface, borderRadius: radius.md, padding: 14, marginBottom: 12, ...shadow.card },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  name: { fontSize: 14, fontWeight: '800', color: A.ink },
  sub: { fontSize: 12, color: A.muted, marginTop: 2 },
  currentBadge: { backgroundColor: '#dcfce7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  currentBadgeText: { fontSize: 10, fontWeight: '700', color: '#15803d' },
  detailLine: { fontSize: 12, color: A.muted, marginTop: 4, lineHeight: 17 },

  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionBtn: { flexGrow: 1, height: 38, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  editBtn: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: A.border },
  editText: { color: A.ink, fontWeight: '700', fontSize: 12 },
  deleteBtn: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#fca5a5' },
  deleteText: { color: '#b91c1c', fontWeight: '700', fontSize: 12 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,13,35,0.5)', justifyContent: 'flex-end' },
  modalBox: { maxHeight: '92%', backgroundColor: A.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: spacing(2.5) },
  modalTitle: { fontSize: 16, fontWeight: '800', color: A.ink, marginBottom: spacing(1.5) },
  sectionTitle: { fontSize: 12, fontWeight: '800', color: A.primary, marginTop: 14, marginBottom: 8, textTransform: 'uppercase' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  switchLabel: { fontSize: 13, color: A.ink, fontWeight: '600' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: spacing(1), marginBottom: spacing(2) },
});
