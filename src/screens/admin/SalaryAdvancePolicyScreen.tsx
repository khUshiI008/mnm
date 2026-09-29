import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Button from '../../components/Button';
import TextField from '../../components/TextField';
import DateField from '../../components/DateField';
import { colors, radius, shadow, spacing } from '../../theme';
import {
  createSalaryAdvancePolicy,
  deleteSalaryAdvancePolicy,
  getSalaryAdvancePolicies,
  SalaryAdvancePolicyPayload,
  SalaryAdvancePolicyRow,
  updateSalaryAdvancePolicy,
} from '../../api/adminSalaryAdvancePolicyApi';

const A = colors.admin;

function todayYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Mirrors Panel/SalaryAdvancePolicies/Index.aspx — company-wide salary advance eligibility rules. Only one policy can be "current" at a time. */
export default function SalaryAdvancePolicyScreen() {
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<SalaryAdvancePolicyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [formTarget, setFormTarget] = useState<{ row?: SalaryAdvancePolicyRow } | null>(null);

  const load = useCallback(async (term?: string) => {
    setLoading(true);
    try {
      const res = await getSalaryAdvancePolicies(term);
      setRows(res.data.policies);
    } catch {
      Alert.alert('Could not load salary advance policies');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = (row: SalaryAdvancePolicyRow) => {
    Alert.alert('Archive this policy?', `${row.policyName} will be archived.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Archive',
        style: 'destructive',
        onPress: async () => {
          setBusyId(row.salaryAdvancePolicyId);
          try {
            await deleteSalaryAdvancePolicy(row.salaryAdvancePolicyId);
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
            <Text style={styles.emptyText}>No salary advance policies found. Tap Add to create the first one.</Text>
          ) : (
            rows.map((row) => (
              <View key={row.salaryAdvancePolicyId} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{row.policyName}</Text>
                    <Text style={styles.sub}>Effective {row.effectiveFromDisplay}</Text>
                  </View>
                  {row.isCurrent && (
                    <View style={styles.currentPill}>
                      <Text style={styles.currentPillText}>Current</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.detailLine}>
                  Max advance {row.maxAdvancePercent}% · CL threshold {row.clThresholdDays}d · {row.daysInMonth}d/month
                </Text>
                <Text style={styles.detailLine}>Processing day: {row.processingDay}</Text>

                <View style={styles.actionsRow}>
                  <Pressable style={[styles.actionBtn, styles.editBtn]} onPress={() => setFormTarget({ row })}>
                    <Text style={styles.editText}>Edit</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.actionBtn, styles.deleteBtn]}
                    onPress={() => handleDelete(row)}
                    disabled={busyId === row.salaryAdvancePolicyId}
                  >
                    {busyId === row.salaryAdvancePolicyId ? <ActivityIndicator size="small" color="#b91c1c" /> : <Text style={styles.deleteText}>Archive</Text>}
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {formTarget && (
        <SalaryAdvancePolicyFormModal
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

function SalaryAdvancePolicyFormModal({
  row,
  onClose,
  onSaved,
}: {
  row?: SalaryAdvancePolicyRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const insets = useSafeAreaInsets();
  const isEdit = !!row;
  const [policyName, setPolicyName] = useState(row?.policyName || '');
  const [effectiveFrom, setEffectiveFrom] = useState(todayYmd());
  const [maxAdvancePercent, setMaxAdvancePercent] = useState(String(row?.maxAdvancePercent ?? 25));
  const [clThresholdDays, setClThresholdDays] = useState(String(row?.clThresholdDays ?? 2));
  const [daysInMonth, setDaysInMonth] = useState(String(row?.daysInMonth ?? 30));
  const [processingDay, setProcessingDay] = useState(String(row?.processingDay ?? 23));
  const [isCurrent, setIsCurrent] = useState(row?.isCurrent ?? false);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const payload: SalaryAdvancePolicyPayload = {
      policyName,
      effectiveFrom,
      maxAdvancePercent: Number(maxAdvancePercent),
      clThresholdDays: Number(clThresholdDays),
      daysInMonth: Number(daysInMonth),
      processingDay: Number(processingDay),
      isCurrent,
    };

    setSaving(true);
    try {
      if (isEdit) await updateSalaryAdvancePolicy(row!.salaryAdvancePolicyId, payload);
      else await createSalaryAdvancePolicy(payload);
      Alert.alert('Saved', `Salary advance policy ${isEdit ? 'updated' : 'created'} successfully.`);
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
            <TextField label="Max Advance % (0-100) *" value={maxAdvancePercent} onChangeText={setMaxAdvancePercent} keyboardType="number-pad" />
            <TextField label="CL Threshold Days (0-31) *" value={clThresholdDays} onChangeText={setClThresholdDays} keyboardType="number-pad" />
            <TextField label="Days in Month (28-31) *" value={daysInMonth} onChangeText={setDaysInMonth} keyboardType="number-pad" />
            <TextField label="Processing Day (1-31) *" value={processingDay} onChangeText={setProcessingDay} keyboardType="number-pad" />

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Set as Current Policy</Text>
              <Switch value={isCurrent} onValueChange={setIsCurrent} trackColor={{ true: A.primary }} />
            </View>

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
  detailLine: { fontSize: 12, color: A.muted, marginTop: 2 },
  currentPill: { backgroundColor: '#dcfce7', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  currentPillText: { fontSize: 10, fontWeight: '800', color: '#15803d' },

  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionBtn: { flexGrow: 1, height: 38, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  editBtn: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: A.border },
  editText: { color: A.ink, fontWeight: '700', fontSize: 12 },
  deleteBtn: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#fca5a5' },
  deleteText: { color: '#b91c1c', fontWeight: '700', fontSize: 12 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,13,35,0.5)', justifyContent: 'flex-end' },
  modalBox: { maxHeight: '92%', backgroundColor: A.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: spacing(2.5) },
  modalTitle: { fontSize: 16, fontWeight: '800', color: A.ink, marginBottom: spacing(1.5) },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  switchLabel: { fontSize: 13, color: A.ink, fontWeight: '600' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: spacing(1), marginBottom: spacing(2) },
});
