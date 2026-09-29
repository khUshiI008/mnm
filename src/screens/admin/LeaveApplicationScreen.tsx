import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Picker } from '../../components/AppPicker';
import Icon from '../../components/Icon';
import Button from '../../components/Button';
import TextField from '../../components/TextField';
import DateField from '../../components/DateField';
import { colors, radius, shadow, spacing } from '../../theme';
import {
  ApplicationRow,
  ApplyPayload,
  BalanceItem,
  cancelLeaveApplication,
  createLeaveApplication,
  EmployeePickerItem,
  getApplicationHistory,
  getEmployeeLeaveBalances,
  getLeaveTypes,
  LeaveTypeOption,
  searchEmployeesForLeave,
  updateLeaveApplication,
} from '../../api/adminLeaveApi';

const A = colors.admin;
const PAGE_SIZE = 25;
const STATUS_COLOR: Record<string, string> = { Pending: '#d97706', Approved: '#15803d', Rejected: '#b91c1c', Cancelled: '#6b7280' };

/** Every calendar day counts, Sat/Sun included — matches the backend's calcTotalDays (adminLeaveApplicationService.js). */
function calcWorkingDays(fromStr: string, toStr: string): number {
  if (!fromStr || !toStr) return 0;
  const d1 = new Date(fromStr);
  const d2 = new Date(toStr);
  if (isNaN(d1.getTime()) || isNaN(d2.getTime()) || d2 < d1) return 0;
  let days = 0;
  for (let d = new Date(d1); d <= d2; d.setDate(d.getDate() + 1)) days++;
  return days;
}


export default function LeaveApplicationScreen() {
  const [rows, setRows] = useState<ApplicationRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [formTarget, setFormTarget] = useState<{ row?: ApplicationRow } | null>(null);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const res = await getApplicationHistory({ page: p, pageSize: PAGE_SIZE });
      setRows(res.data.rows);
      setTotal(res.data.total);
      setTotalPages(res.data.totalPages);
      setPage(res.data.page);
    } catch {
      Alert.alert('Could not load leave applications');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(0);
  }, [load]);

  const handleCancel = (row: ApplicationRow) => {
    Alert.alert('Cancel this application?', `${row.empName}'s ${row.shortCode} request will be cancelled.`, [
      { text: 'No', style: 'cancel' },
      {
        text: 'Cancel Application',
        style: 'destructive',
        onPress: async () => {
          setBusyId(row.leaveApplicationId);
          try {
            await cancelLeaveApplication(row.leaveApplicationId);
            await load(page);
          } catch (err: any) {
            Alert.alert('Could not cancel', err?.response?.data?.message || 'Please try again.');
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
        <Text style={styles.countText}>{total} applications</Text>
        <Pressable style={styles.addBtn} onPress={() => setFormTarget({})}>
          <Text style={styles.addBtnText}>+ Apply Leave</Text>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={A.primary} style={styles.loader} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {rows.length === 0 ? (
            <Text style={styles.emptyText}>No leave applications yet.</Text>
          ) : (
            rows.map((row) => (
              <View key={row.leaveApplicationId} style={styles.row}>
                <View style={styles.rowHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowName}>
                      {row.empName} <Text style={styles.rowCode}>· {row.empCode}</Text>
                    </Text>
                    <Text style={styles.rowSub}>
                      {row.leaveTypeName} ({row.shortCode}) · {row.fromDateDisplay} – {row.toDateDisplay} · {row.totalDays}d
                    </Text>
                    {row.reason ? <Text style={styles.rowReason}>{row.reason}</Text> : null}
                    <Text style={styles.rowApprover}>Approver: {row.approverName} ({row.routingType})</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: (STATUS_COLOR[row.status] || A.muted) + '1f' }]}>
                    <Text style={[styles.statusBadgeText, { color: STATUS_COLOR[row.status] || A.muted }]}>{row.status}</Text>
                  </View>
                </View>

                {row.status === 'Pending' && (
                  <View style={styles.rowActions}>
                    <Pressable style={[styles.actionBtn, styles.cancelBtn]} onPress={() => handleCancel(row)} disabled={busyId === row.leaveApplicationId}>
                      {busyId === row.leaveApplicationId ? <ActivityIndicator size="small" color={A.muted} /> : <Text style={styles.cancelText}>Cancel</Text>}
                    </Pressable>
                    <Pressable style={[styles.actionBtn, styles.editBtn]} onPress={() => setFormTarget({ row })}>
                      <Text style={styles.editText}>Edit</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            ))
          )}

          {totalPages > 1 && (
            <View style={styles.pagination}>
              <Pressable disabled={page <= 0} onPress={() => load(page - 1)} style={styles.pageBtn}>
                <Icon name="chevronLeft" size={16} color={page <= 0 ? A.border : A.ink} />
              </Pressable>
              <Text style={styles.pageInfo}>
                Page {page + 1} of {totalPages}
              </Text>
              <Pressable disabled={page >= totalPages - 1} onPress={() => load(page + 1)} style={styles.pageBtn}>
                <Icon name="chevronRight" size={16} color={page >= totalPages - 1 ? A.border : A.ink} />
              </Pressable>
            </View>
          )}
        </ScrollView>
      )}

      {formTarget && (
        <ApplyModal
          row={formTarget.row}
          onClose={() => setFormTarget(null)}
          onSaved={() => {
            setFormTarget(null);
            load(page);
          }}
        />
      )}
    </View>
  );
}

function ApplyModal({ row, onClose, onSaved }: { row?: ApplicationRow; onClose: () => void; onSaved: () => void }) {
  const insets = useSafeAreaInsets();
  const isEdit = !!row;
  const [emp, setEmp] = useState<EmployeePickerItem | null>(row ? { id: row.employeeId, name: row.empName, code: row.empCode } : null);
  const [empSearch, setEmpSearch] = useState('');
  const [empResults, setEmpResults] = useState<EmployeePickerItem[]>([]);
  const [types, setTypes] = useState<LeaveTypeOption[]>([]);
  const [leaveTypeId, setLeaveTypeId] = useState<number>(0);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [reason, setReason] = useState(row?.reason || '');
  const [balances, setBalances] = useState<BalanceItem[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getLeaveTypes().then((res) => setTypes(res.data.types)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!empSearch) {
      setEmpResults([]);
      return;
    }
    const t = setTimeout(() => {
      searchEmployeesForLeave(empSearch).then((res) => setEmpResults(res.data.employees)).catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [empSearch]);

  useEffect(() => {
    if (emp) getEmployeeLeaveBalances(emp.id).then((res) => setBalances(res.data.balances)).catch(() => {});
  }, [emp]);

  const days = calcWorkingDays(fromDate, toDate);
  const selectedBalance = balances.find((b) => types.find((t) => t.leaveTypeId === leaveTypeId)?.shortCode === b.shortCode);

  const save = async () => {
    if (!emp) return Alert.alert('Please select an employee.');
    if (!leaveTypeId) return Alert.alert('Please select a leave type.');
    if (days <= 0) return Alert.alert('Please select a valid date range.');
    if (!reason.trim()) return Alert.alert('Please enter a reason.');

    const payload: ApplyPayload = { employeeId: emp.id, leaveTypeId, fromDate, toDate, reason: reason.trim() };
    setSaving(true);
    try {
      const res = isEdit ? await updateLeaveApplication(row!.leaveApplicationId, payload) : await createLeaveApplication(payload);
      Alert.alert('Saved', res.data.message);
      onSaved();
    } catch (err: any) {
      Alert.alert('Could not save', err?.response?.data?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={[styles.modalBox, { paddingBottom: spacing(2.5) + insets.bottom }]} onPress={(e) => e.stopPropagation()}>
          <ScrollView>
            <Text style={styles.modalTitle}>{isEdit ? 'Edit Leave Application' : 'Apply Leave'}</Text>

            {!isEdit && (
              <>
                <TextField label="Employee" placeholder="Search name or code..." value={emp ? `${emp.name} (${emp.code})` : empSearch} onChangeText={(v) => { setEmp(null); setEmpSearch(v); }} />
                {empResults.length > 0 && !emp && (
                  <View style={styles.empResultsBox}>
                    {empResults.map((e) => (
                      <Pressable key={e.id} style={styles.empResultRow} onPress={() => { setEmp(e); setEmpSearch(''); setEmpResults([]); }}>
                        <Text style={styles.empResultText}>{e.name} ({e.code})</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </>
            )}
            {isEdit && <Text style={styles.readonlyEmp}>{emp?.name} ({emp?.code})</Text>}

            <Text style={styles.label}>Leave Type</Text>
            <View style={styles.pickerWrap}>
              <Picker selectedValue={leaveTypeId} onValueChange={(v) => setLeaveTypeId(Number(v))}>
                <Picker.Item label="— Select Leave Type —" value={0} />
                {types.map((t) => (
                  <Picker.Item key={t.leaveTypeId} label={`${t.name} (${t.shortCode})`} value={t.leaveTypeId} />
                ))}
              </Picker>
            </View>

            <DateField label="From Date" granularity="day" value={fromDate} onChange={setFromDate} placeholder="Select date" />
            <DateField label="To Date" granularity="day" value={toDate} onChange={setToDate} placeholder="Select date" />
            {days > 0 && <Text style={styles.daysPill}>{days} day{days !== 1 ? 's' : ''}</Text>}
            <Text style={styles.weekendHint}>
              ✅ Applying here approves immediately on submit — the employee will be notified — even if this exceeds their remaining balance.
            </Text>
            {selectedBalance && (
              <Text style={styles.balanceInfo}>
                Balance: {selectedBalance.remaining} of {selectedBalance.entitled} remaining
              </Text>
            )}

            <TextField label="Reason" value={reason} onChangeText={setReason} multiline numberOfLines={3} />

            <View style={styles.modalActions}>
              <Button title="Cancel" variant="outline" onPress={onClose} style={{ flex: 1 }} />
              <Button title={isEdit ? 'Save Changes' : 'Submit'} onPress={save} loading={saving} style={{ flex: 1 }} />
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
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing(2), paddingBottom: 0 },
  countText: { color: A.muted, fontSize: 12 },
  addBtn: { height: 38, paddingHorizontal: 14, borderRadius: radius.sm, backgroundColor: A.primary, alignItems: 'center', justifyContent: 'center' },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  emptyText: { color: A.muted, fontSize: 13, textAlign: 'center', marginTop: spacing(4) },

  row: { backgroundColor: A.surface, borderRadius: radius.md, padding: 12, marginBottom: 10, ...shadow.card },
  rowHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  rowName: { fontSize: 13, fontWeight: '800', color: A.ink },
  rowCode: { fontWeight: '500', color: A.muted },
  rowSub: { fontSize: 12, color: A.muted, marginTop: 3 },
  rowReason: { fontSize: 12, color: A.muted, marginTop: 3, fontStyle: 'italic' },
  rowApprover: { fontSize: 11, color: A.muted, marginTop: 3 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  statusBadgeText: { fontSize: 10, fontWeight: '700' },

  rowActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  actionBtn: { flex: 1, height: 36, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  cancelBtn: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: A.border },
  cancelText: { color: A.muted, fontWeight: '700', fontSize: 12 },
  editBtn: { backgroundColor: A.primary },
  editText: { color: '#fff', fontWeight: '700', fontSize: 12 },

  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: spacing(1) },
  pageBtn: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: A.surface, borderWidth: 1, borderColor: A.border },
  pageInfo: { fontSize: 12, color: A.muted, fontWeight: '600' },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,13,35,0.5)', justifyContent: 'flex-end' },
  modalBox: { maxHeight: '90%', backgroundColor: A.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: spacing(2.5) },
  modalTitle: { fontSize: 16, fontWeight: '800', color: A.ink, marginBottom: spacing(1.5) },
  label: { fontSize: 13, color: A.muted, marginBottom: 6, fontWeight: '500' },
  pickerWrap: { borderWidth: 1, borderColor: A.border, borderRadius: radius.sm, marginBottom: 16, backgroundColor: A.surface },
  readonlyEmp: { fontSize: 14, fontWeight: '700', color: A.ink, marginBottom: 16 },
  empResultsBox: { borderWidth: 1, borderColor: A.border, borderRadius: radius.sm, marginTop: -8, marginBottom: 16, backgroundColor: A.surface, maxHeight: 160 },
  empResultRow: { padding: 10, borderBottomWidth: 1, borderBottomColor: A.border },
  empResultText: { fontSize: 13, color: A.ink },
  daysPill: { fontSize: 12, fontWeight: '700', color: A.primary, marginBottom: 8 },
  weekendHint: { fontSize: 12, color: '#15803d', backgroundColor: '#f0fdf4', borderRadius: 8, padding: 10, marginBottom: 12, lineHeight: 17 },
  balanceInfo: { fontSize: 12, color: A.muted, marginBottom: 16 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: spacing(1) },
});
