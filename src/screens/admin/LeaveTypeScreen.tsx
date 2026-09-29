import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Button from '../../components/Button';
import TextField from '../../components/TextField';
import { colors, radius, shadow, spacing } from '../../theme';
import {
  createLeaveType,
  deleteLeaveType,
  getLeaveTypesAdmin,
  LeaveTypePayload,
  LeaveTypeRow,
  updateLeaveType,
} from '../../api/adminLeaveTypeApi';

const A = colors.admin;

export default function LeaveTypeScreen() {
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<LeaveTypeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [formTarget, setFormTarget] = useState<{ row?: LeaveTypeRow } | null>(null);

  const load = useCallback(async (term?: string) => {
    setLoading(true);
    try {
      const res = await getLeaveTypesAdmin(term);
      setRows(res.data.leaveTypes);
    } catch {
      Alert.alert('Could not load leave types');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = (row: LeaveTypeRow) => {
    Alert.alert('Archive this leave type?', `${row.leaveTypeName} will be archived and hidden from active lists.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Archive',
        style: 'destructive',
        onPress: async () => {
          setBusyId(row.leaveTypeId);
          try {
            await deleteLeaveType(row.leaveTypeId);
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
          placeholder="Search leave type or code..."
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
          <Text style={styles.countText}>{rows.length} leave types</Text>
          {rows.length === 0 ? (
            <Text style={styles.emptyText}>No leave types found. Tap Add to create the first one.</Text>
          ) : (
            rows.map((row) => (
              <View key={row.leaveTypeId} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>
                      {row.leaveTypeName} <Text style={styles.code}>· {row.shortCode}</Text>
                    </Text>
                    <Text style={styles.sub}>{row.monthlyEntitlement} days / month · {row.isPaidLeave ? 'Paid' : 'Unpaid'}</Text>
                  </View>
                </View>
                <Text style={styles.detailLine}>
                  {row.requiresApproval ? 'Requires approval' : 'Auto-approved'} · {row.carryForwardAllowed ? `Carry forward up to ${row.maxCarryForwardDays}d` : 'No carry forward'}
                </Text>
                <Text style={styles.detailLine}>{row.sameDayLabel}</Text>

                <View style={styles.actionsRow}>
                  <Pressable style={[styles.actionBtn, styles.editBtn]} onPress={() => setFormTarget({ row })}>
                    <Text style={styles.editText}>Edit</Text>
                  </Pressable>
                  <Pressable style={[styles.actionBtn, styles.deleteBtn]} onPress={() => handleDelete(row)} disabled={busyId === row.leaveTypeId}>
                    {busyId === row.leaveTypeId ? <ActivityIndicator size="small" color="#b91c1c" /> : <Text style={styles.deleteText}>Archive</Text>}
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {formTarget && (
        <LeaveTypeFormModal
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

function LeaveTypeFormModal({ row, onClose, onSaved }: { row?: LeaveTypeRow; onClose: () => void; onSaved: () => void }) {
  const insets = useSafeAreaInsets();
  const isEdit = !!row;
  const [leaveTypeName, setLeaveTypeName] = useState(row?.leaveTypeName || '');
  const [shortCode, setShortCode] = useState(row?.shortCode || '');
  const [monthlyEntitlement, setMonthlyEntitlement] = useState(String(row?.monthlyEntitlement ?? 4));
  const [requiresApproval, setRequiresApproval] = useState(row?.requiresApproval ?? true);
  const [isPaidLeave, setIsPaidLeave] = useState(row?.isPaidLeave ?? true);
  const [carryForwardAllowed, setCarryForwardAllowed] = useState(row?.carryForwardAllowed ?? false);
  const [maxCarryForwardDays, setMaxCarryForwardDays] = useState(String(row?.maxCarryForwardDays ?? 0));
  const [allowSameDayApplication, setAllowSameDayApplication] = useState(row?.allowSameDayApplication ?? false);
  const [sameDayCutoff, setSameDayCutoff] = useState(row?.sameDayApplicationCutoffTime?.slice(0, 5) || '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const payload: LeaveTypePayload = {
      leaveTypeName,
      shortCode,
      monthlyEntitlement: Number(monthlyEntitlement),
      requiresApproval,
      isPaidLeave,
      carryForwardAllowed,
      maxCarryForwardDays: carryForwardAllowed ? Number(maxCarryForwardDays) : 0,
      allowSameDayApplication,
      sameDayApplicationCutoffTime: allowSameDayApplication ? sameDayCutoff : undefined,
    };

    setSaving(true);
    try {
      if (isEdit) await updateLeaveType(row!.leaveTypeId, payload);
      else await createLeaveType(payload);
      Alert.alert('Saved', `Leave type ${isEdit ? 'updated' : 'created'} successfully.`);
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
            <Text style={styles.modalTitle}>{isEdit ? 'Edit Leave Type' : 'Add Leave Type'}</Text>

            <TextField label="Leave Type Name *" value={leaveTypeName} onChangeText={setLeaveTypeName} />
            <TextField label="Short Code (2-5 chars) *" value={shortCode} onChangeText={setShortCode} autoCapitalize="characters" maxLength={5} />
            <TextField label="Monthly Entitlement (days, 0-31) *" value={monthlyEntitlement} onChangeText={setMonthlyEntitlement} keyboardType="number-pad" />

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Requires Approval</Text>
              <Switch value={requiresApproval} onValueChange={setRequiresApproval} trackColor={{ true: A.primary }} />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Paid Leave</Text>
              <Switch value={isPaidLeave} onValueChange={setIsPaidLeave} trackColor={{ true: A.primary }} />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Carry Forward Allowed</Text>
              <Switch value={carryForwardAllowed} onValueChange={setCarryForwardAllowed} trackColor={{ true: A.primary }} />
            </View>
            {carryForwardAllowed && (
              <TextField label="Max Carry Forward (days, 0-365) *" value={maxCarryForwardDays} onChangeText={setMaxCarryForwardDays} keyboardType="number-pad" />
            )}

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Allow Same Day Application</Text>
              <Switch value={allowSameDayApplication} onValueChange={setAllowSameDayApplication} trackColor={{ true: A.primary }} />
            </View>
            {allowSameDayApplication && (
              <TextField label="Same Day Cutoff Time (HH:mm, optional)" value={sameDayCutoff} onChangeText={setSameDayCutoff} placeholder="07:00" />
            )}

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
  code: { fontWeight: '500', color: A.muted },
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
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  switchLabel: { fontSize: 13, color: A.ink, fontWeight: '600' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: spacing(1), marginBottom: spacing(2) },
});
