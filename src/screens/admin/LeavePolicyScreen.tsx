import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Picker } from '../../components/AppPicker';
import Button from '../../components/Button';
import TextField from '../../components/TextField';
import { colors, radius, shadow, spacing } from '../../theme';
import {
  createLeavePolicy,
  deleteLeavePolicy,
  getLeavePolicies,
  LeavePolicyPayload,
  LeavePolicyRow,
  updateLeavePolicy,
} from '../../api/adminLeavePolicyApi';

const A = colors.admin;

/** Mirrors Panel/LeavePolicies/Index.aspx — week-off day, week-off leave block, allowed days/month per policy. */
export default function LeavePolicyScreen() {
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<LeavePolicyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [formTarget, setFormTarget] = useState<{ row?: LeavePolicyRow } | null>(null);

  const load = useCallback(async (term?: string) => {
    setLoading(true);
    try {
      const res = await getLeavePolicies(term);
      setRows(res.data.policies);
    } catch {
      Alert.alert('Could not load leave policies');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = (row: LeavePolicyRow) => {
    Alert.alert(
      'Delete this policy?',
      `${row.policyName} will be archived and unlinked from any employees currently assigned to it.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setBusyId(row.leavePolicyId);
            try {
              await deleteLeavePolicy(row.leavePolicyId);
              await load(search || undefined);
            } catch (err: any) {
              Alert.alert('Could not delete', err?.response?.data?.message || 'Please try again.');
            } finally {
              setBusyId(null);
            }
          },
        },
      ]
    );
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
          <Text style={styles.countText}>{rows.length} leave policies</Text>
          {rows.length === 0 ? (
            <Text style={styles.emptyText}>No leave policies found. Tap Add to create the first one.</Text>
          ) : (
            rows.map((row) => (
              <View key={row.leavePolicyId} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{row.policyName}</Text>
                    <Text style={styles.sub}>
                      Week-off: {row.weekOffLabel} · {row.allowedLeaveDaysPerMonth} days/month
                    </Text>
                  </View>
                </View>
                <Text style={styles.detailLine}>{row.blockWeekOffLeave ? 'Blocks leave on week-off day' : 'Week-off leave allowed'}</Text>
                {!!row.description && <Text style={styles.detailLine}>{row.description}</Text>}

                <View style={styles.actionsRow}>
                  <Pressable style={[styles.actionBtn, styles.editBtn]} onPress={() => setFormTarget({ row })}>
                    <Text style={styles.editText}>Edit</Text>
                  </Pressable>
                  <Pressable style={[styles.actionBtn, styles.deleteBtn]} onPress={() => handleDelete(row)} disabled={busyId === row.leavePolicyId}>
                    {busyId === row.leavePolicyId ? <ActivityIndicator size="small" color="#b91c1c" /> : <Text style={styles.deleteText}>Delete</Text>}
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {formTarget && (
        <LeavePolicyFormModal
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

function LeavePolicyFormModal({ row, onClose, onSaved }: { row?: LeavePolicyRow; onClose: () => void; onSaved: () => void }) {
  const insets = useSafeAreaInsets();
  const isEdit = !!row;
  const [policyName, setPolicyName] = useState(row?.policyName || '');
  const [weekOffDay, setWeekOffDay] = useState(row?.weekOffDay || 'Sunday');
  const [blockWeekOffLeave, setBlockWeekOffLeave] = useState(row?.blockWeekOffLeave ?? true);
  const [allowedDays, setAllowedDays] = useState(String(row?.allowedLeaveDaysPerMonth ?? 4));
  const [description, setDescription] = useState(row?.description || '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const payload: LeavePolicyPayload = {
      policyName,
      weekOffDay: weekOffDay as LeavePolicyPayload['weekOffDay'],
      blockWeekOffLeave,
      allowedLeaveDaysPerMonth: Number(allowedDays),
      description: description || undefined,
    };

    setSaving(true);
    try {
      if (isEdit) await updateLeavePolicy(row!.leavePolicyId, payload);
      else await createLeavePolicy(payload);
      Alert.alert('Saved', `Leave policy ${isEdit ? 'updated' : 'created'} successfully.`);
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
            <Text style={styles.modalTitle}>{isEdit ? 'Edit Leave Policy' : 'Add Leave Policy'}</Text>

            <TextField label="Policy Name *" value={policyName} onChangeText={setPolicyName} />

            <Text style={styles.label}>Week-Off Day</Text>
            <View style={styles.pickerWrap}>
              <Picker selectedValue={weekOffDay} onValueChange={setWeekOffDay}>
                <Picker.Item label="None" value="None" />
                <Picker.Item label="Sunday" value="Sunday" />
                <Picker.Item label="Saturday" value="Saturday" />
                <Picker.Item label="Saturday + Sunday" value="SaturdaySunday" />
              </Picker>
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Block Leave on Week-Off Day</Text>
              <Switch value={blockWeekOffLeave} onValueChange={setBlockWeekOffLeave} trackColor={{ true: A.primary }} />
            </View>

            <TextField label="Allowed Leave Days / Month (0-31) *" value={allowedDays} onChangeText={setAllowedDays} keyboardType="number-pad" />
            <TextField label="Description (optional)" value={description} onChangeText={setDescription} multiline numberOfLines={2} />

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
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  switchLabel: { fontSize: 13, color: A.ink, fontWeight: '600' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: spacing(1), marginBottom: spacing(2) },
});
