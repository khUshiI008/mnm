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
  activateSchedule,
  createSchedule,
  deactivateSchedule,
  deleteRecovery,
  getMonthlyRecoveries,
  getRecoveryEmployees,
  getRecoverySchedules,
  MonthlyRecoveryRow,
  receiveRecovery,
  RecoveryEmployee,
  RecoveryScheduleRow,
  RecoverySummary,
  SchedulePayload,
  updateSchedule,
} from '../../api/adminMonthlyRecoveryApi';

const A = colors.admin;
const DUE_CSS_COLOR: Record<string, string> = { 'due-today': '#d97706', 'due-soon': '#d97706', '': '#6b7280' };

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function MonthlyRecoveryScreen() {
  const [tab, setTab] = useState<'schedules' | 'recoveries'>('recoveries');
  const [schedules, setSchedules] = useState<RecoveryScheduleRow[]>([]);
  const [activeCount, setActiveCount] = useState(0);
  const [employees, setEmployees] = useState<RecoveryEmployee[]>([]);
  const [recoveries, setRecoveries] = useState<MonthlyRecoveryRow[]>([]);
  const [summary, setSummary] = useState<RecoverySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [scheduleForm, setScheduleForm] = useState<{ row?: RecoveryScheduleRow } | null>(null);
  const [receiveTarget, setReceiveTarget] = useState<MonthlyRecoveryRow | null>(null);

  const loadSchedules = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getRecoverySchedules();
      setSchedules(res.data.schedules);
      setActiveCount(res.data.activeCount);
    } catch {
      Alert.alert('Could not load recovery schedules');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRecoveries = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getMonthlyRecoveries();
      setRecoveries(res.data.recoveries);
      setSummary(res.data.summary);
    } catch {
      Alert.alert('Could not load monthly recoveries');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    getRecoveryEmployees().then((res) => setEmployees(res.data.employees)).catch(() => {});
  }, []);

  useEffect(() => {
    if (tab === 'schedules') loadSchedules();
    else loadRecoveries();
  }, [tab, loadSchedules, loadRecoveries]);

  const handleToggleActive = (row: RecoveryScheduleRow) => {
    const activate = !row.isActive;
    Alert.alert(activate ? 'Reactivate this schedule?' : 'Deactivate this schedule?', `${row.employeeDisplay} — ₹${row.amountDisplay}/month.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: activate ? 'Reactivate' : 'Deactivate',
        style: activate ? 'default' : 'destructive',
        onPress: async () => {
          setBusyId(row.recoveryScheduleId);
          try {
            const res = activate ? await activateSchedule(row.recoveryScheduleId) : await deactivateSchedule(row.recoveryScheduleId);
            Alert.alert('Done', res.data.message);
            await loadSchedules();
          } catch (err: any) {
            Alert.alert('Could not update', err?.response?.data?.message || 'Please try again.');
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  const handleDeleteRecovery = (row: MonthlyRecoveryRow) => {
    Alert.alert('Delete this record?', `${row.employeeDisplay}'s recovery for ${row.recoveryMonthDisplay} will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setBusyId(row.recoveryId);
          try {
            await deleteRecovery(row.recoveryId);
            await loadRecoveries();
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
      <View style={styles.tabRow}>
        <Pressable style={[styles.tabBtn, tab === 'recoveries' && styles.tabBtnActive]} onPress={() => setTab('recoveries')}>
          <Text style={[styles.tabBtnText, tab === 'recoveries' && styles.tabBtnTextActive]}>Recoveries</Text>
        </Pressable>
        <Pressable style={[styles.tabBtn, tab === 'schedules' && styles.tabBtnActive]} onPress={() => setTab('schedules')}>
          <Text style={[styles.tabBtnText, tab === 'schedules' && styles.tabBtnTextActive]}>Schedules ({activeCount})</Text>
        </Pressable>
      </View>

      {tab === 'recoveries' ? (
        <>
          {summary && (
            <View style={styles.kpiRow}>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiValue}>{summary.pendingCount}</Text>
                <Text style={styles.kpiLabel}>Pending ₹{summary.pendingAmountDisplay}</Text>
              </View>
              <View style={styles.kpiCard}>
                <Text style={[styles.kpiValue, { color: '#15803d' }]}>{summary.receivedCount}</Text>
                <Text style={styles.kpiLabel}>Received ₹{summary.receivedAmountDisplay}</Text>
              </View>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiValue}>₹{summary.totalTargetDisplay}</Text>
                <Text style={styles.kpiLabel}>Total Target</Text>
              </View>
            </View>
          )}

          {loading ? (
            <ActivityIndicator size="large" color={A.primary} style={styles.loader} />
          ) : (
            <ScrollView contentContainerStyle={styles.content}>
              {recoveries.length === 0 ? (
                <Text style={styles.emptyText}>No monthly recovery records found.</Text>
              ) : (
                recoveries.map((row) => (
                  <View key={row.recoveryId} style={styles.card}>
                    <View style={styles.cardHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.name}>{row.employeeDisplay}</Text>
                        <Text style={styles.sub}>{row.recoveryMonthDisplay}{row.description ? ` · ${row.description}` : ''}</Text>
                      </View>
                      <View style={[styles.statusBadge, row.status === 'Received' && styles.statusBadgeReceived]}>
                        <Text style={[styles.statusBadgeText, row.status === 'Received' && styles.statusBadgeTextReceived]}>{row.status}</Text>
                      </View>
                    </View>

                    <Text style={styles.amount}>₹{row.targetAmountDisplay}</Text>
                    {row.status === 'Received' ? (
                      <Text style={styles.detailLine}>Received ₹{row.receivedAmountDisplay} · {row.paymentMode}</Text>
                    ) : (
                      <Text style={[styles.detailLine, { color: DUE_CSS_COLOR[row.dueDateCss] }]}>{row.dueDateLabel} · {row.entryDateDisplay}</Text>
                    )}

                    <View style={styles.actionsRow}>
                      {row.status === 'Pending' && (
                        <Pressable style={styles.receiveBtn} onPress={() => setReceiveTarget(row)}>
                          <Text style={styles.receiveBtnText}>Receive</Text>
                        </Pressable>
                      )}
                      <Pressable style={styles.deleteIconBtn} onPress={() => handleDeleteRecovery(row)} disabled={busyId === row.recoveryId}>
                        {busyId === row.recoveryId ? <ActivityIndicator size="small" color={A.muted} /> : <Text style={styles.deleteIconText}>Delete</Text>}
                      </Pressable>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          )}
        </>
      ) : (
        <>
          <View style={styles.topRow}>
            <Text style={styles.countText}>{schedules.length} schedules</Text>
            <Pressable style={styles.addBtn} onPress={() => setScheduleForm({})}>
              <Text style={styles.addBtnText}>+ Add</Text>
            </Pressable>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color={A.primary} style={styles.loader} />
          ) : (
            <ScrollView contentContainerStyle={styles.content}>
              {schedules.length === 0 ? (
                <Text style={styles.emptyText}>No recovery schedules found. Tap Add to create the first one.</Text>
              ) : (
                schedules.map((row) => (
                  <View key={row.recoveryScheduleId} style={styles.card}>
                    <View style={styles.cardHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.name}>{row.employeeDisplay}</Text>
                        <Text style={styles.sub}>Due day {row.dueDay} · {row.startDateDisplay} → {row.endDateDisplay}</Text>
                      </View>
                      <View style={[styles.statusBadge, !row.isActive && styles.statusBadgeMuted]}>
                        <Text style={[styles.statusBadgeText, !row.isActive && styles.statusBadgeTextMuted]}>{row.statusLabel}</Text>
                      </View>
                    </View>
                    <Text style={styles.amount}>₹{row.amountDisplay}/month</Text>
                    {!!row.description && <Text style={styles.detailLine}>{row.description}</Text>}

                    <View style={styles.actionsRow}>
                      <Pressable style={[styles.actionBtn, styles.editBtn]} onPress={() => setScheduleForm({ row })}>
                        <Text style={styles.editText}>Edit</Text>
                      </Pressable>
                      <Pressable
                        style={[styles.actionBtn, row.isActive ? styles.deactivateBtn : styles.activateBtn]}
                        onPress={() => handleToggleActive(row)}
                        disabled={busyId === row.recoveryScheduleId}
                      >
                        {busyId === row.recoveryScheduleId ? (
                          <ActivityIndicator size="small" color={row.isActive ? '#b91c1c' : '#15803d'} />
                        ) : (
                          <Text style={row.isActive ? styles.deactivateText : styles.activateText}>{row.isActive ? 'Deactivate' : 'Reactivate'}</Text>
                        )}
                      </Pressable>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          )}
        </>
      )}

      {scheduleForm && (
        <ScheduleFormModal
          row={scheduleForm.row}
          employees={employees}
          onClose={() => setScheduleForm(null)}
          onSaved={() => {
            setScheduleForm(null);
            loadSchedules();
          }}
        />
      )}

      {receiveTarget && (
        <ReceiveModal
          row={receiveTarget}
          onClose={() => setReceiveTarget(null)}
          onSaved={() => {
            setReceiveTarget(null);
            loadRecoveries();
          }}
        />
      )}
    </View>
  );
}

function ScheduleFormModal({
  row,
  employees,
  onClose,
  onSaved,
}: {
  row?: RecoveryScheduleRow;
  employees: RecoveryEmployee[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const insets = useSafeAreaInsets();
  const isEdit = !!row;
  const [employeeId, setEmployeeId] = useState<number | ''>(row?.employeeId || '');
  const [amount, setAmount] = useState(row ? row.amountDisplay.replace(/,/g, '') : '');
  const [dueDay, setDueDay] = useState(row ? String(row.dueDay) : '10');
  const [startDate, setStartDate] = useState(row?.startDate?.slice(0, 7) || todayIso().slice(0, 7));
  const [endDate, setEndDate] = useState(row?.endDate?.slice(0, 7) || '');
  const [description, setDescription] = useState(row?.description || '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!employeeId) return Alert.alert('Please select an employee.');
    const payload: SchedulePayload = {
      employeeId: Number(employeeId),
      amount: Number(amount),
      dueDay: Number(dueDay),
      startDate,
      endDate: endDate || undefined,
      description,
    };
    setSaving(true);
    try {
      if (isEdit) await updateSchedule(row!.recoveryScheduleId, payload);
      else await createSchedule(payload);
      Alert.alert('Saved', `Recovery schedule ${isEdit ? 'updated' : 'created'} successfully.`);
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
            <Text style={styles.modalTitle}>{isEdit ? 'Edit Recovery Schedule' : 'New Recovery Schedule'}</Text>

            <Text style={styles.label}>Employee *</Text>
            <SearchableSelect
              selectedValue={employeeId}
              onValueChange={(v) => setEmployeeId(v as number | '')}
              items={employees.map((e) => ({ label: e.label, value: e.employeeId }))}
              placeholder="-- Select Employee --"
              searchPlaceholder="Search name or code"
              title="Select Employee"
            />

            <TextField label="Amount *" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
            <TextField label="Due Day of Month (1-28) *" value={dueDay} onChangeText={setDueDay} keyboardType="number-pad" />
            <DateField label="Start Month *" granularity="month" value={startDate} onChange={setStartDate} placeholder="Select month" />
            <DateField label="End Month (optional)" granularity="month" value={endDate} onChange={setEndDate} placeholder="Leave blank for ongoing" clearable />
            <TextField label="Description" value={description} onChangeText={setDescription} multiline numberOfLines={2} />

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

function ReceiveModal({ row, onClose, onSaved }: { row: MonthlyRecoveryRow; onClose: () => void; onSaved: () => void }) {
  const insets = useSafeAreaInsets();
  const [receivedAmount, setReceivedAmount] = useState(row.targetAmountDisplay);
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const amt = Number(receivedAmount);
    if (!amt || amt <= 0) return Alert.alert('Enter a valid received amount.');
    setSaving(true);
    try {
      await receiveRecovery(row.recoveryId, { receivedAmount: amt, paymentMode, remarks });
      Alert.alert('Received', 'Recovery marked as Received.');
      onSaved();
    } catch (err: any) {
      Alert.alert('Could not save', err?.response?.data?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={[styles.modalBox, { paddingBottom: spacing(2.5) + insets.bottom }]} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.modalTitle}>Receive Recovery</Text>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLine}>{row.employeeDisplay}</Text>
            <Text style={styles.summaryLine}>{row.recoveryMonthDisplay} · Target ₹{row.targetAmountDisplay}</Text>
            {!!row.description && <Text style={styles.summaryLine}>{row.description}</Text>}
          </View>

          <TextField label="Received Amount" value={receivedAmount} onChangeText={setReceivedAmount} keyboardType="decimal-pad" />
          <Text style={styles.label}>Payment Mode</Text>
          <View style={styles.pickerWrap}>
            <Picker selectedValue={paymentMode} onValueChange={setPaymentMode}>
              <Picker.Item label="Cash" value="Cash" />
              <Picker.Item label="Online Transfer" value="Online Transfer" />
              <Picker.Item label="Credit Note" value="Credit Note" />
              <Picker.Item label="Debit Note" value="Debit Note" />
            </Picker>
          </View>
          <TextField label="Remarks" value={remarks} onChangeText={setRemarks} multiline numberOfLines={2} />

          <View style={styles.modalActions}>
            <Button title="Cancel" variant="outline" onPress={onClose} style={{ flex: 1 }} />
            <Button title="Confirm Receipt" onPress={save} loading={saving} style={{ flex: 1 }} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: A.bg },
  loader: { marginTop: spacing(4) },
  content: { padding: spacing(2) },

  tabRow: { flexDirection: 'row', gap: 8, padding: spacing(2), paddingBottom: 0 },
  tabBtn: { flex: 1, height: 40, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: A.surface, borderWidth: 1, borderColor: A.border },
  tabBtnActive: { backgroundColor: A.primary, borderColor: A.primary },
  tabBtnText: { fontSize: 13, fontWeight: '700', color: A.muted },
  tabBtnTextActive: { color: '#fff' },

  kpiRow: { flexDirection: 'row', gap: 8, paddingHorizontal: spacing(2), paddingTop: spacing(2) },
  kpiCard: { flex: 1, backgroundColor: A.surface, borderRadius: radius.md, padding: 12, ...shadow.card },
  kpiValue: { fontSize: 16, fontWeight: '800', color: A.ink },
  kpiLabel: { fontSize: 10, color: A.muted, marginTop: 2, fontWeight: '600' },

  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: spacing(2), paddingBottom: 0 },
  countText: { color: A.muted, fontSize: 12, flex: 1 },
  addBtn: { height: 42, paddingHorizontal: 16, borderRadius: radius.sm, backgroundColor: A.primary, alignItems: 'center', justifyContent: 'center' },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  emptyText: { color: A.muted, fontSize: 13, textAlign: 'center', marginTop: spacing(4) },

  card: { backgroundColor: A.surface, borderRadius: radius.md, padding: 14, marginBottom: 12, ...shadow.card },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  name: { fontSize: 14, fontWeight: '800', color: A.ink },
  sub: { fontSize: 12, color: A.muted, marginTop: 2 },
  statusBadge: { backgroundColor: '#fef3c7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  statusBadgeText: { fontSize: 10, fontWeight: '700', color: '#92400e' },
  statusBadgeReceived: { backgroundColor: '#dcfce7' },
  statusBadgeTextReceived: { color: '#15803d' },
  statusBadgeMuted: { backgroundColor: '#f1f5f9' },
  statusBadgeTextMuted: { color: A.muted },
  amount: { fontSize: 18, fontWeight: '800', color: A.ink, marginTop: 4 },
  detailLine: { fontSize: 12, color: A.muted, marginTop: 4, fontWeight: '600' },

  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionBtn: { flexGrow: 1, height: 36, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  editBtn: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: A.border },
  editText: { color: A.ink, fontWeight: '700', fontSize: 12 },
  deactivateBtn: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#fca5a5' },
  deactivateText: { color: '#b91c1c', fontWeight: '700', fontSize: 12 },
  activateBtn: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#86efac' },
  activateText: { color: '#15803d', fontWeight: '700', fontSize: 12 },
  receiveBtn: { flexGrow: 1, height: 36, borderRadius: 9, backgroundColor: A.primary, alignItems: 'center', justifyContent: 'center' },
  receiveBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  deleteIconBtn: { height: 36, paddingHorizontal: 12, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  deleteIconText: { color: A.muted, fontSize: 12, fontWeight: '600' },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,13,35,0.5)', justifyContent: 'flex-end' },
  modalBox: { maxHeight: '92%', backgroundColor: A.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: spacing(2.5) },
  modalTitle: { fontSize: 16, fontWeight: '800', color: A.ink, marginBottom: spacing(1.5) },
  label: { fontSize: 13, color: A.muted, marginBottom: 6, fontWeight: '500' },
  pickerWrap: { borderWidth: 1, borderColor: A.border, borderRadius: radius.sm, marginBottom: 16, backgroundColor: A.surface },
  summaryBox: { backgroundColor: A.surfaceRaised, borderRadius: radius.sm, padding: 12, marginBottom: 16 },
  summaryLine: { fontSize: 12, color: A.ink, marginBottom: 3 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: spacing(1), marginBottom: spacing(2) },
});
