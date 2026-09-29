import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Picker } from '../../components/AppPicker';
import Icon from '../../components/Icon';
import { colors, radius, shadow, spacing } from '../../theme';
import LeaveDecisionModal, { LeaveDecisionOption, LeaveDecisionStatus } from '../../components/admin/LeaveDecisionModal';
import {
  adminApproveLeave,
  adminCancelLeave,
  adminRejectLeave,
  changeLeaveDecision,
  BalanceMatrixRow,
  getBalanceMatrix,
  getLeaveAdminGrid,
  getLeaveAdminKpis,
  getLeaveTypes,
  LeaveAdminKpis,
  LeaveAdminRow,
  LeaveTypeOption,
} from '../../api/adminLeaveApi';

const A = colors.admin;
const PAGE_SIZE = 25;
const STATUS_COLOR: Record<string, string> = { Pending: '#d97706', Approved: '#15803d', Rejected: '#b91c1c', Cancelled: '#6b7280' };
const CELL_COLOR: Record<string, string> = { gray: '#9ca3af', red: '#dc2626', blue: '#2563eb' };

const ALL_DECISIONS: LeaveDecisionOption[] = [
  { label: 'Approve', value: 'Approved' },
  { label: 'Reject', value: 'Rejected' },
  { label: 'Cancel Leave', value: 'Cancelled' },
];

export default function LeaveAdminScreen() {
  const [kpis, setKpis] = useState<LeaveAdminKpis | null>(null);
  const [status, setStatus] = useState('');
  const [typeId, setTypeId] = useState(0);
  const [types, setTypes] = useState<LeaveTypeOption[]>([]);
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<LeaveAdminRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [matrix, setMatrix] = useState<{ monthLabel: string; leaveTypes: { shortCode: string; name: string }[]; rows: BalanceMatrixRow[] } | null>(null);
  const [decisionTarget, setDecisionTarget] = useState<LeaveAdminRow | null>(null);
  const [decisionMode, setDecisionMode] = useState<'reject' | 'change' | 'undo'>('reject');

  useEffect(() => {
    getLeaveTypes().then((res) => setTypes(res.data.types)).catch(() => {});
    getBalanceMatrix().then((res) => setMatrix(res.data)).catch(() => {});
  }, []);

  const load = useCallback(
    async (p: number) => {
      setLoading(true);
      try {
        const [kpiRes, gridRes] = await Promise.all([
          getLeaveAdminKpis(),
          getLeaveAdminGrid({ status: status || undefined, typeId: typeId || undefined, search: search || undefined, page: p, pageSize: PAGE_SIZE }),
        ]);
        setKpis(kpiRes.data);
        setRows(gridRes.data.rows);
        setTotal(gridRes.data.total);
        setTotalPages(gridRes.data.totalPages);
        setPage(gridRes.data.page);
      } catch {
        Alert.alert('Could not load leave admin data');
      } finally {
        setLoading(false);
      }
    },
    [status, typeId, search]
  );

  useEffect(() => {
    load(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, typeId]);

  const refreshAll = async () => {
    await load(page);
    getBalanceMatrix().then((res) => setMatrix(res.data)).catch(() => {});
  };

  const handleApprove = (row: LeaveAdminRow) => {
    Alert.alert('Approve leave?', `${row.empName}'s ${row.shortCode} request.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Approve',
        onPress: async () => {
          setBusyId(row.leaveApplicationId);
          try {
            await adminApproveLeave(row.leaveApplicationId);
            await refreshAll();
          } catch (err: any) {
            Alert.alert('Could not approve', err?.response?.data?.message || 'Please try again.');
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  const handleCancel = (row: LeaveAdminRow) => {
    Alert.alert('Cancel leave?', `${row.empName}'s ${row.shortCode} request will be withdrawn.`, [
      { text: 'No', style: 'cancel' },
      {
        text: 'Cancel Leave',
        style: 'destructive',
        onPress: async () => {
          setBusyId(row.leaveApplicationId);
          try {
            await adminCancelLeave(row.leaveApplicationId);
            await refreshAll();
          } catch (err: any) {
            Alert.alert('Could not cancel', err?.response?.data?.message || 'Please try again.');
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  const openReject = (row: LeaveAdminRow) => {
    setDecisionMode('reject');
    setDecisionTarget(row);
  };

  const openChangeDecision = (row: LeaveAdminRow) => {
    setDecisionMode('change');
    setDecisionTarget(row);
  };

  // "Undo" — for when Approve/Reject was actioned by mistake. Moves the application
  // straight back to Pending so it reappears in the normal approval queue.
  const openUndo = (row: LeaveAdminRow) => {
    setDecisionMode('undo');
    setDecisionTarget(row);
  };

  const decisionOptions: LeaveDecisionOption[] =
    decisionMode === 'reject'
      ? [{ label: 'Reject', value: 'Rejected' }]
      : decisionMode === 'undo'
      ? [{ label: 'Undo', value: 'Pending' }]
      : ALL_DECISIONS.filter((o) => o.value !== decisionTarget?.status);

  const submitDecision = async (newStatus: LeaveDecisionStatus, remarks: string) => {
    if (!decisionTarget) return;
    setBusyId(decisionTarget.leaveApplicationId);
    try {
      if (decisionMode === 'reject') {
        await adminRejectLeave(decisionTarget.leaveApplicationId, remarks);
      } else {
        await changeLeaveDecision(decisionTarget.leaveApplicationId, newStatus, remarks);
      }
      setDecisionTarget(null);
      await refreshAll();
    } catch (err: any) {
      Alert.alert('Could not save', err?.response?.data?.message || 'Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        {kpis && (
          <View style={styles.kpiRow}>
            <KpiCard label="Pending" value={kpis.pending} tint="#d97706" />
            <KpiCard label="Approved (mo.)" value={kpis.approvedThisMonth} sub={`${kpis.approvedDaysThisMonth} days`} tint="#15803d" />
            <KpiCard label="Rejected (mo.)" value={kpis.rejectedThisMonth} tint="#b91c1c" />
            <KpiCard label="Total (mo.)" value={kpis.totalThisMonth} tint={A.primary} />
          </View>
        )}

        <View style={styles.filterRow}>
          <View style={styles.filterPicker}>
            <Picker selectedValue={status} onValueChange={setStatus}>
              <Picker.Item label="All Statuses" value="" />
              <Picker.Item label="Pending" value="Pending" />
              <Picker.Item label="Approved" value="Approved" />
              <Picker.Item label="Rejected" value="Rejected" />
              <Picker.Item label="Cancelled" value="Cancelled" />
            </Picker>
          </View>
          <View style={styles.filterPicker}>
            <Picker selectedValue={typeId} onValueChange={(v) => setTypeId(Number(v))}>
              <Picker.Item label="All Types" value={0} />
              {types.map((t) => (
                <Picker.Item key={t.leaveTypeId} label={t.name} value={t.leaveTypeId} />
              ))}
            </Picker>
          </View>
        </View>
        <View style={styles.searchRow}>
          <Icon name="search" size={16} color={A.muted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search employee, code..."
            placeholderTextColor={A.muted}
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={() => load(0)}
            returnKeyType="search"
          />
        </View>

        <Text style={styles.sectionHeading}>Applications ({total})</Text>
        {loading ? (
          <ActivityIndicator size="large" color={A.primary} style={styles.loader} />
        ) : rows.length === 0 ? (
          <Text style={styles.emptyText}>No applications match these filters.</Text>
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
                  <Text style={styles.rowActioned}>
                    {row.actionedBy.awaiting ? 'Awaiting' : `${row.actionedBy.name} · ${row.actionedBy.dateDisplay}`}
                  </Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: (STATUS_COLOR[row.status] || A.muted) + '1f' }]}>
                  <Text style={[styles.statusBadgeText, { color: STATUS_COLOR[row.status] || A.muted }]}>{row.status}</Text>
                </View>
              </View>

              {row.status === 'Pending' ? (
                <View style={styles.rowActions}>
                  <Pressable style={[styles.actionBtn, styles.rejectBtn]} onPress={() => openReject(row)} disabled={busyId === row.leaveApplicationId}>
                    <Text style={styles.rejectText}>Reject</Text>
                  </Pressable>
                  <Pressable style={[styles.actionBtn, styles.approveBtn]} onPress={() => handleApprove(row)} disabled={busyId === row.leaveApplicationId}>
                    {busyId === row.leaveApplicationId ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.approveText}>Approve</Text>}
                  </Pressable>
                  <Pressable style={[styles.actionBtn, styles.cancelBtn]} onPress={() => handleCancel(row)} disabled={busyId === row.leaveApplicationId}>
                    <Text style={styles.cancelText}>Cancel</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.rowActions}>
                  {(row.status === 'Approved' || row.status === 'Rejected') && (
                    <Pressable style={[styles.actionBtn, styles.undoBtn]} onPress={() => openUndo(row)} disabled={busyId === row.leaveApplicationId}>
                      {busyId === row.leaveApplicationId ? <ActivityIndicator size="small" color="#92400e" /> : <Text style={styles.undoText}>Undo</Text>}
                    </Pressable>
                  )}
                  <Pressable style={[styles.actionBtn, styles.changeBtn]} onPress={() => openChangeDecision(row)} disabled={busyId === row.leaveApplicationId}>
                    {busyId === row.leaveApplicationId ? <ActivityIndicator size="small" color={A.primary} /> : <Text style={styles.changeText}>Change Decision</Text>}
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

        {matrix && (
          <>
            <Text style={styles.sectionHeading}>Balance Matrix — {matrix.monthLabel}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.matrixScroll}>
              <View>
                <View style={styles.matrixHeaderRow}>
                  <Text style={[styles.matrixCell, styles.matrixNameCol, styles.matrixHeaderText]}>Employee</Text>
                  {matrix.leaveTypes.map((lt) => (
                    <Text key={lt.shortCode} style={[styles.matrixCell, styles.matrixHeaderText]}>
                      {lt.shortCode}
                    </Text>
                  ))}
                </View>
                {matrix.rows.map((r) => (
                  <View key={r.employeeId} style={styles.matrixRow}>
                    <View style={[styles.matrixCell, styles.matrixNameCol]}>
                      <Text style={styles.matrixName} numberOfLines={1}>
                        {r.employeeName}
                      </Text>
                      <Text style={styles.matrixCode}>{r.code}</Text>
                    </View>
                    {r.cells.map((c) => (
                      <View key={c.shortCode} style={styles.matrixCell}>
                        <Text style={{ color: CELL_COLOR[c.color], fontWeight: '700', fontSize: 13 }}>{c.remaining}</Text>
                        <Text style={styles.matrixEntitled}>/{c.entitled}</Text>
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            </ScrollView>
          </>
        )}
      </ScrollView>

      <LeaveDecisionModal
        target={decisionTarget ? { id: decisionTarget.leaveApplicationId, empName: decisionTarget.empName, shortCode: decisionTarget.shortCode } : null}
        title={
          decisionMode === 'reject'
            ? `Reject ${decisionTarget?.empName}'s ${decisionTarget?.shortCode} request?`
            : decisionMode === 'undo'
            ? `Undo ${decisionTarget?.empName}'s ${decisionTarget?.shortCode} decision? It'll go back to Pending.`
            : `Change decision for ${decisionTarget?.empName}'s ${decisionTarget?.shortCode} request`
        }
        options={decisionOptions}
        busy={busyId === decisionTarget?.leaveApplicationId}
        onClose={() => setDecisionTarget(null)}
        onSubmit={submitDecision}
      />
    </View>
  );
}

function KpiCard({ label, value, sub, tint }: { label: string; value: number; sub?: string; tint: string }) {
  return (
    <View style={styles.kpiCard}>
      <Text style={[styles.kpiValue, { color: tint }]}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
      {sub ? <Text style={styles.kpiSub}>{sub}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: A.bg },
  content: { padding: spacing(2), paddingBottom: spacing(5) },
  loader: { marginVertical: spacing(3) },
  emptyText: { color: A.muted, fontSize: 13, textAlign: 'center', marginVertical: spacing(3) },

  kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing(2) },
  kpiCard: { flexBasis: '47%', flexGrow: 1, backgroundColor: A.surface, borderRadius: radius.md, padding: 12, ...shadow.card },
  kpiValue: { fontSize: 22, fontWeight: '800' },
  kpiLabel: { fontSize: 11, color: A.muted, marginTop: 2, fontWeight: '600' },
  kpiSub: { fontSize: 10, color: A.muted, marginTop: 2 },

  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  filterPicker: { flex: 1, borderWidth: 1, borderColor: A.border, borderRadius: radius.sm, backgroundColor: A.surface },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: A.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: A.border,
    paddingHorizontal: 12,
    height: 42,
    marginBottom: spacing(2),
  },
  searchInput: { flex: 1, fontSize: 14, color: A.ink },

  sectionHeading: { fontSize: 14, fontWeight: '800', color: A.ink, marginBottom: spacing(1.5), marginTop: spacing(1) },

  row: { backgroundColor: A.surface, borderRadius: radius.md, padding: 12, marginBottom: 10, ...shadow.card },
  rowHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  rowName: { fontSize: 13, fontWeight: '800', color: A.ink },
  rowCode: { fontWeight: '500', color: A.muted },
  rowSub: { fontSize: 12, color: A.muted, marginTop: 3 },
  rowActioned: { fontSize: 11, color: A.muted, marginTop: 3, fontStyle: 'italic' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  statusBadgeText: { fontSize: 10, fontWeight: '700' },

  rowActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  actionBtn: { flex: 1, height: 36, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  rejectBtn: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#fca5a5' },
  rejectText: { color: '#b91c1c', fontWeight: '700', fontSize: 12 },
  approveBtn: { backgroundColor: '#15803d' },
  approveText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  cancelBtn: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: A.border },
  cancelText: { color: A.muted, fontWeight: '700', fontSize: 12 },
  changeBtn: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: A.border },
  changeText: { color: A.primary, fontWeight: '700', fontSize: 12 },
  undoBtn: { backgroundColor: '#fffbeb', borderWidth: 1.5, borderColor: '#fde68a' },
  undoText: { color: '#92400e', fontWeight: '700', fontSize: 12 },

  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginVertical: spacing(1) },
  pageBtn: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: A.surface, borderWidth: 1, borderColor: A.border },
  pageInfo: { fontSize: 12, color: A.muted, fontWeight: '600' },

  matrixScroll: { backgroundColor: A.surface, borderRadius: radius.md, ...shadow.card },
  matrixHeaderRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: A.border, paddingVertical: 8 },
  matrixHeaderText: { fontSize: 10, fontWeight: '700', color: A.muted, textTransform: 'uppercase' },
  matrixRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: A.border, paddingVertical: 8 },
  matrixCell: { width: 64, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  matrixNameCol: { width: 140, alignItems: 'flex-start', flexDirection: 'column', paddingHorizontal: 8 },
  matrixName: { fontSize: 12, fontWeight: '700', color: A.ink },
  matrixCode: { fontSize: 10, color: A.muted },
  matrixEntitled: { fontSize: 10, color: A.muted },
});
