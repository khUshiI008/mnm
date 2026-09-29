import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Picker } from '../../components/AppPicker';
import Button from '../../components/Button';
import TextField from '../../components/TextField';
import DateField from '../../components/DateField';
import SearchableSelect from '../../components/common/SearchableSelect';
import { colors, radius, shadow, spacing } from '../../theme';
import {
  createSalaryRevision,
  deleteSalaryRevision,
  getSalaryRevisionEmployees,
  getSalaryRevisions,
  SalaryRevisionEmployee,
  SalaryRevisionPayload,
  SalaryRevisionRow,
  updateSalaryRevision,
} from '../../api/adminSalaryRevisionApi';

const A = colors.admin;

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function SalaryRevisionScreen() {
  const [rows, setRows] = useState<SalaryRevisionRow[]>([]);
  const [employees, setEmployees] = useState<SalaryRevisionEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [formTarget, setFormTarget] = useState<{ row?: SalaryRevisionRow } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getSalaryRevisions();
      setRows(res.data.revisions);
    } catch {
      Alert.alert('Could not load salary revisions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    getSalaryRevisionEmployees().then((res) => setEmployees(res.data.employees)).catch(() => {});
    load();
  }, [load]);

  const handleDelete = (row: SalaryRevisionRow) => {
    Alert.alert('Delete this revision?', `${row.employeeName}'s revision effective ${row.effectiveFromDisplay} will be removed.${row.isCurrent ? ' The previous revision will become current again.' : ''}`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setBusyId(row.salaryRevisionId);
          try {
            await deleteSalaryRevision(row.salaryRevisionId);
            await load();
          } catch (err: any) {
            Alert.alert('Could not delete', err?.response?.data?.message || 'Please try again.');
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
        <Text style={styles.countText}>{rows.length} revisions</Text>
        <Pressable style={styles.addBtn} onPress={() => setFormTarget({})}>
          <Text style={styles.addBtnText}>+ Add</Text>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={A.primary} style={styles.loader} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {rows.length === 0 ? (
            <Text style={styles.emptyText}>No salary revisions found. Tap Add to create the first one.</Text>
          ) : (
            rows.map((row) => (
              <View key={row.salaryRevisionId} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{row.employeeName} <Text style={styles.code}>· {row.code}</Text></Text>
                    <Text style={styles.sub}>{row.revisionType}{row.reasonNote ? ` · ${row.reasonNote}` : ''}</Text>
                  </View>
                  {row.isCurrent && (
                    <View style={styles.currentBadge}>
                      <Text style={styles.currentBadgeText}>Current</Text>
                    </View>
                  )}
                </View>

                <Text style={styles.amount}>₹{row.basicSalaryDisplay}</Text>
                <Text style={styles.detailLine}>{row.effectiveFromDisplay} → {row.effectiveToDisplay}</Text>

                <View style={styles.actionsRow}>
                  <Pressable style={[styles.actionBtn, styles.editBtn]} onPress={() => setFormTarget({ row })}>
                    <Text style={styles.editText}>Edit</Text>
                  </Pressable>
                  <Pressable style={[styles.actionBtn, styles.deleteBtn]} onPress={() => handleDelete(row)} disabled={busyId === row.salaryRevisionId}>
                    {busyId === row.salaryRevisionId ? <ActivityIndicator size="small" color="#b91c1c" /> : <Text style={styles.deleteText}>Delete</Text>}
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {formTarget && (
        <RevisionFormModal
          row={formTarget.row}
          employees={employees}
          onClose={() => setFormTarget(null)}
          onSaved={() => {
            setFormTarget(null);
            load();
          }}
        />
      )}
    </View>
  );
}

function RevisionFormModal({
  row,
  employees,
  onClose,
  onSaved,
}: {
  row?: SalaryRevisionRow;
  employees: SalaryRevisionEmployee[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const insets = useSafeAreaInsets();
  const isEdit = !!row;
  const [employeeId, setEmployeeId] = useState<number | ''>(row?.employeeId || '');
  const [basicSalary, setBasicSalary] = useState(row ? String(row.basicSalary) : '');
  const [effectiveFrom, setEffectiveFrom] = useState(row?.effectiveFrom?.slice(0, 10) || todayIso());
  const [revisionType, setRevisionType] = useState(row?.revisionType || 'Annual Increment');
  const [reasonNote, setReasonNote] = useState(row?.reasonNote || '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!employeeId) return Alert.alert('Please select an employee.');
    const payload: SalaryRevisionPayload = {
      employeeId: Number(employeeId),
      basicSalary: Number(basicSalary),
      effectiveFrom,
      revisionType,
      reasonNote,
    };
    setSaving(true);
    try {
      if (isEdit) await updateSalaryRevision(row!.salaryRevisionId, payload);
      else await createSalaryRevision(payload);
      Alert.alert('Saved', `Salary revision ${isEdit ? 'updated' : 'added'} successfully.`);
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
            <Text style={styles.modalTitle}>{isEdit ? 'Edit Salary Revision' : 'Add Salary Revision'}</Text>

            <Text style={styles.label}>Employee *</Text>
            <SearchableSelect
              enabled={!isEdit}
              selectedValue={employeeId}
              onValueChange={(v) => setEmployeeId(v as number | '')}
              items={employees.map((e) => ({ label: e.label, value: e.employeeId }))}
              placeholder="-- Select Employee --"
              searchPlaceholder="Search name or code"
              title="Select Employee"
            />

            <TextField label="Basic Salary *" value={basicSalary} onChangeText={setBasicSalary} keyboardType="decimal-pad" />
            <DateField label="Effective From *" granularity="day" value={effectiveFrom} onChange={setEffectiveFrom} placeholder="Select date" />

            <Text style={styles.label}>Revision Type *</Text>
            <View style={styles.pickerWrap}>
              <Picker selectedValue={revisionType} onValueChange={setRevisionType}>
                <Picker.Item label="Annual Increment" value="Annual Increment" />
                <Picker.Item label="Promotion" value="Promotion" />
                <Picker.Item label="Joining Salary" value="Joining Salary" />
                <Picker.Item label="Correction" value="Correction" />
                <Picker.Item label="Other" value="Other" />
              </Picker>
            </View>

            <TextField label="Reason Note" value={reasonNote} onChangeText={setReasonNote} multiline numberOfLines={2} />

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
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: spacing(2), paddingBottom: 0 },
  countText: { color: A.muted, fontSize: 12, flex: 1 },
  addBtn: { height: 42, paddingHorizontal: 16, borderRadius: radius.sm, backgroundColor: A.primary, alignItems: 'center', justifyContent: 'center' },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  emptyText: { color: A.muted, fontSize: 13, textAlign: 'center', marginTop: spacing(4) },

  card: { backgroundColor: A.surface, borderRadius: radius.md, padding: 14, marginBottom: 12, ...shadow.card },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  name: { fontSize: 14, fontWeight: '800', color: A.ink },
  code: { fontWeight: '500', color: A.muted },
  sub: { fontSize: 12, color: A.muted, marginTop: 2 },
  currentBadge: { backgroundColor: '#dcfce7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  currentBadgeText: { fontSize: 10, fontWeight: '700', color: '#15803d' },
  amount: { fontSize: 20, fontWeight: '800', color: A.ink, marginTop: 4 },
  detailLine: { fontSize: 12, color: A.muted, marginTop: 4 },

  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionBtn: { flexGrow: 1, height: 38, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  editBtn: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: A.border },
  editText: { color: A.ink, fontWeight: '700', fontSize: 12 },
  deleteBtn: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#fca5a5' },
  deleteText: { color: '#b91c1c', fontWeight: '700', fontSize: 12 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,13,35,0.5)', justifyContent: 'flex-end' },
  modalBox: { maxHeight: '92%', backgroundColor: A.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: spacing(2.5) },
  modalTitle: { fontSize: 16, fontWeight: '800', color: A.ink, marginBottom: spacing(1.5) },
  label: { fontSize: 13, color: A.muted, marginBottom: 6, fontWeight: '500' },
  pickerWrap: { borderWidth: 1, borderColor: A.border, borderRadius: radius.sm, marginBottom: 16, backgroundColor: A.surface },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: spacing(1), marginBottom: spacing(2) },
});
