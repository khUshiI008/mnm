import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Picker } from '../../components/AppPicker';
import Icon from '../../components/Icon';
import { colors, radius, shadow, spacing } from '../../theme';
import AttendanceCalendarModal from '../../components/admin/AttendanceCalendarModal';
import LeaveDecisionModal, { LeaveDecisionOption, LeaveDecisionStatus } from '../../components/admin/LeaveDecisionModal';
import LeaveConflictModal, { LeaveConflictData } from '../../components/admin/LeaveConflictModal';
import { resolveFileUrl } from '../../utils/fileUrl';
import { usePermission } from '../../hooks/usePermission';
import {
  approveLeaveApplication,
  ApprovalCard,
  changeLeaveDecision,
  checkApprovalConflict,
  getApprovalQueue,
  getLeaveTypes,
  LeaveTypeOption,
  rejectLeaveApplication,
} from '../../api/adminLeaveApi';

const A = colors.admin;
const PAGE_SIZE = 25;

const STATUS_COLOR: Record<string, string> = { Pending: '#d97706', Approved: '#15803d', Rejected: '#b91c1c', Cancelled: '#6b7280' };

const ALL_DECISIONS: LeaveDecisionOption[] = [
  { label: 'Approve', value: 'Approved' },
  { label: 'Reject', value: 'Rejected' },
  { label: 'Cancel Leave', value: 'Cancelled' },
];

export default function LeaveApprovalScreen({ params }: { params?: { leaveApplicationId?: number } }) {
  const listRef = useRef<FlatList<ApprovalCard>>(null);
  // Set from a notification tap (e.g. "LeaveApplied") — highlights and
  // scrolls to that specific application's card once it's loaded.
  const highlightId = params?.leaveApplicationId;
  const [status, setStatus] = useState('Pending');
  const [typeId, setTypeId] = useState<number>(0);
  const [types, setTypes] = useState<LeaveTypeOption[]>([]);
  const [search, setSearch] = useState('');
  const [cards, setCards] = useState<ApprovalCard[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [calendarEmpId, setCalendarEmpId] = useState<number | null>(null);
  const [conflictCard, setConflictCard] = useState<ApprovalCard | null>(null);
  const [conflictData, setConflictData] = useState<LeaveConflictData | null>(null);
  const [detailsData, setDetailsData] = useState<LeaveConflictData | null>(null);
  const [detailsBusyId, setDetailsBusyId] = useState<number | null>(null);
  const [decisionTarget, setDecisionTarget] = useState<ApprovalCard | null>(null);
  const [decisionMode, setDecisionMode] = useState<'reject' | 'change' | 'undo'>('reject');
  const canApprove = usePermission('LeaveApproval', 'Approve');
  const canReject = usePermission('LeaveApproval', 'Reject');
  // Not offered in the permission registry (V1 scope) — always false for a manager, so the
  // button below simply never renders for them; true for admin like every other check here.
  const canChangeDecision = usePermission('LeaveApproval', 'ChangeDecision');

  useEffect(() => {
    getLeaveTypes().then((res) => setTypes(res.data.types)).catch(() => {});
  }, []);

  const load = useCallback(
    async (p: number) => {
      setLoading(true);
      try {
        const res = await getApprovalQueue({
          status: status || undefined,
          typeId: typeId || undefined,
          search: search || undefined,
          page: p,
          pageSize: PAGE_SIZE,
        });
        setCards(res.data.cards);
        setTotal(res.data.total);
        setTotalPages(res.data.totalPages);
        setPage(res.data.page);
      } catch {
        Alert.alert('Could not load leave applications');
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

  useEffect(() => {
    if (!highlightId || !cards.length) return;
    const index = cards.findIndex((c) => c.leaveApplicationId === highlightId);
    if (index >= 0) {
      const t = setTimeout(() => listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.3 }), 200);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [highlightId, cards]);

  const runSearch = () => load(0);

  const doApprove = async (card: ApprovalCard, forceClQuotaOverride?: boolean): Promise<boolean> => {
    setBusyId(card.leaveApplicationId);
    try {
      const res = await approveLeaveApplication(card.leaveApplicationId, forceClQuotaOverride);
      await load(page);
      if (res.data.warning) {
        Alert.alert('Approved with override', res.data.message);
      }
      return true;
    } catch (err: any) {
      const data = err?.response?.data;
      // The CL-quota gate no longer mutates the application on its own — it
      // only blocks and reports back (see adminLeaveApprovalService.js's
      // approve()). This only fires here if quota status changed between the
      // conflict pre-check and this call (a rare race); the normal path
      // already caught it earlier via checkApprovalConflict + the modal.
      if (data?.clQuotaBlocked) {
        setBusyId(null);
        Alert.alert('CL quota would be exceeded', data.message, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Approve Anyway', onPress: () => doApprove(card, true) },
        ]);
        return false;
      }
      Alert.alert('Could not approve', data?.message || 'Please try again.');
      return false;
    } finally {
      setBusyId(null);
    }
  };

  const handleApprove = async (card: ApprovalCard) => {
    setBusyId(card.leaveApplicationId);
    try {
      const res = await checkApprovalConflict(card.leaveApplicationId);
      setBusyId(null);

      const deptConflicts = res.data.deptConflicts || [];
      const ownOtherLeaves = res.data.ownOtherLeaves || [];
      const clQuotaExceeded = !!res.data.clQuotaExceeded;

      if (!res.data.hasDeptConflict && ownOtherLeaves.length === 0 && !clQuotaExceeded) {
        doApprove(card);
        return;
      }

      setConflictCard(card);
      setConflictData({
        empName: card.empName,
        deptName: res.data.deptName,
        deptFromDisplay: res.data.fromDateDisplay,
        deptToDisplay: res.data.toDateDisplay,
        deptConflicts,
        ownOtherLeaves,
        clQuotaExceeded,
        clConsumed: res.data.clConsumed,
        clQuota: res.data.clQuota,
        clRemaining: res.data.clRemaining,
        clRequested: res.data.clRequested,
      });
    } catch {
      setBusyId(null);
      Alert.alert('Could not check for conflicts', 'Please try again.');
    }
  };

  const handleViewDetails = async (card: ApprovalCard) => {
    setDetailsBusyId(card.leaveApplicationId);
    try {
      const res = await checkApprovalConflict(card.leaveApplicationId);
      setDetailsData({
        empName: card.empName,
        deptName: res.data.deptName,
        deptFromDisplay: res.data.fromDateDisplay,
        deptToDisplay: res.data.toDateDisplay,
        deptConflicts: res.data.deptConflicts || [],
        ownOtherLeaves: res.data.ownOtherLeaves || [],
      });
    } catch {
      Alert.alert('Could not load details', 'Please try again.');
    } finally {
      setDetailsBusyId(null);
    }
  };

  const confirmApproveAnyway = async () => {
    if (!conflictCard) return;
    const ok = await doApprove(conflictCard, conflictData?.clQuotaExceeded);
    if (ok) {
      setConflictCard(null);
      setConflictData(null);
    }
  };

  const handleReject = (card: ApprovalCard) => {
    setDecisionMode('reject');
    setDecisionTarget(card);
  };

  const handleChangeDecision = (card: ApprovalCard) => {
    setDecisionMode('change');
    setDecisionTarget(card);
  };

  // "Undo" — for when Approve/Reject was tapped by mistake. Moves the application
  // straight back to Pending so it reappears in the normal approval queue, instead
  // of forcing the admin to pick a different final decision.
  const handleUndo = (card: ApprovalCard) => {
    setDecisionMode('undo');
    setDecisionTarget(card);
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
        await rejectLeaveApplication(decisionTarget.leaveApplicationId, remarks);
      } else {
        await changeLeaveDecision(decisionTarget.leaveApplicationId, newStatus, remarks);
      }
      setDecisionTarget(null);
      await load(page);
    } catch (err: any) {
      Alert.alert('Could not save', err?.response?.data?.message || 'Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.filterRow}>
        <View style={styles.filterPicker}>
          <Picker selectedValue={status} onValueChange={setStatus}>
            <Picker.Item label="Pending" value="Pending" />
            <Picker.Item label="Approved" value="Approved" />
            <Picker.Item label="Rejected" value="Rejected" />
            <Picker.Item label="Cancelled" value="Cancelled" />
            <Picker.Item label="All" value="" />
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
          placeholder="Search employee, code, leave type..."
          placeholderTextColor={A.muted}
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={runSearch}
          returnKeyType="search"
        />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={A.primary} />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={cards}
          keyExtractor={(c) => String(c.leaveApplicationId)}
          contentContainerStyle={styles.content}
          onScrollToIndexFailed={() => {}}
          ListHeaderComponent={<Text style={styles.countText}>{total} record{total === 1 ? '' : 's'}</Text>}
          ListEmptyComponent={<Text style={styles.emptyText}>No leave applications match these filters.</Text>}
          ListFooterComponent={
            totalPages > 1 ? (
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
            ) : null
          }
          renderItem={({ item }) => (
            <View style={[styles.card, item.leaveApplicationId === highlightId && styles.cardHighlighted]}>
              <Pressable style={styles.cardHeader} onPress={() => setCalendarEmpId(item.employeeId)}>
                {resolveFileUrl(item.photoPath) ? (
                  <Image source={{ uri: resolveFileUrl(item.photoPath)! }} style={styles.avatarPhoto} />
                ) : (
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{initialsOf(item.empName)}</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.empName}</Text>
                  <Text style={styles.sub}>
                    {item.empCode} · {item.deptName || 'No dept'}
                  </Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: (STATUS_COLOR[item.status] || A.muted) + '1f' }]}>
                  <Text style={[styles.statusBadgeText, { color: STATUS_COLOR[item.status] || A.muted }]}>{item.status}</Text>
                </View>
              </Pressable>

              <View style={styles.leaveRow}>
                <Text style={styles.leaveType}>
                  {item.leaveTypeName} ({item.shortCode}) · {item.isPaid}
                </Text>
                <Text style={styles.days}>{item.daysLabel}</Text>
              </View>
              <Text style={styles.dateRange}>
                {item.fromDateDisplay} – {item.toDateDisplay} · Applied {item.appliedOnDisplay}
              </Text>
              {item.reason ? <Text style={styles.reason}>{item.reason}</Text> : null}

              <View style={styles.statRow}>
                <StatBox label="Taken (mo.)" value={item.alreadyTakenThisMonth} />
                <StatBox label="Absent (mo.)" value={item.absentThisMonth} />
                <StatBox label="Half Day (mo.)" value={item.halfDayThisMonth} />
              </View>

              {item.status === 'Pending' ? (
                (canReject || canApprove) && (
                  <View style={styles.actionsRow}>
                    <Pressable style={[styles.actionBtn, styles.detailsBtn]} onPress={() => handleViewDetails(item)} disabled={detailsBusyId === item.leaveApplicationId}>
                      {detailsBusyId === item.leaveApplicationId ? <ActivityIndicator size="small" color={A.primary} /> : <Text style={styles.detailsText}>Details</Text>}
                    </Pressable>
                    {canReject && (
                      <Pressable style={[styles.actionBtn, styles.rejectBtn]} onPress={() => handleReject(item)} disabled={busyId === item.leaveApplicationId}>
                        {busyId === item.leaveApplicationId ? <ActivityIndicator size="small" color="#b91c1c" /> : <Text style={styles.rejectText}>Reject</Text>}
                      </Pressable>
                    )}
                    {canApprove && (
                      <Pressable style={[styles.actionBtn, styles.approveBtn]} onPress={() => handleApprove(item)} disabled={busyId === item.leaveApplicationId}>
                        {busyId === item.leaveApplicationId ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.approveText}>Approve</Text>}
                      </Pressable>
                    )}
                  </View>
                )
              ) : (
                canChangeDecision && (
                  <View style={styles.actionsRow}>
                    {(item.status === 'Approved' || item.status === 'Rejected') && (
                      <Pressable style={[styles.actionBtn, styles.undoBtn]} onPress={() => handleUndo(item)} disabled={busyId === item.leaveApplicationId}>
                        {busyId === item.leaveApplicationId ? <ActivityIndicator size="small" color="#92400e" /> : <Text style={styles.undoText}>Undo</Text>}
                      </Pressable>
                    )}
                    <Pressable style={[styles.actionBtn, styles.changeBtn]} onPress={() => handleChangeDecision(item)} disabled={busyId === item.leaveApplicationId}>
                      {busyId === item.leaveApplicationId ? <ActivityIndicator size="small" color={A.primary} /> : <Text style={styles.changeText}>Change Decision</Text>}
                    </Pressable>
                  </View>
                )
              )}
            </View>
          )}
        />
      )}

      {calendarEmpId != null && <AttendanceCalendarModal visible employeeId={calendarEmpId} onClose={() => setCalendarEmpId(null)} />}

      <LeaveConflictModal
        data={conflictData}
        busy={busyId === conflictCard?.leaveApplicationId}
        onClose={() => {
          setConflictCard(null);
          setConflictData(null);
        }}
        onConfirm={confirmApproveAnyway}
      />

      <LeaveConflictModal data={detailsData} busy={false} mode="details" onClose={() => setDetailsData(null)} />

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

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: A.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing(2) },
  filterRow: { flexDirection: 'row', gap: 8, padding: spacing(2), paddingBottom: 0 },
  filterPicker: { flex: 1, borderWidth: 1, borderColor: A.border, borderRadius: radius.sm, backgroundColor: A.surface },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    margin: spacing(2),
    marginTop: spacing(1),
    marginBottom: 0,
    backgroundColor: A.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: A.border,
    paddingHorizontal: 12,
    height: 42,
  },
  searchInput: { flex: 1, fontSize: 14, color: A.ink },
  countText: { color: A.muted, fontSize: 12, marginBottom: spacing(1.5) },
  emptyText: { color: A.muted, fontSize: 13, textAlign: 'center', marginTop: spacing(4) },

  card: { backgroundColor: A.surface, borderRadius: radius.md, padding: 14, marginBottom: 12, ...shadow.card },
  cardHighlighted: { borderWidth: 2, borderColor: A.primary },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: A.primary + '20', alignItems: 'center', justifyContent: 'center' },
  avatarPhoto: { width: 52, height: 52, borderRadius: 26, backgroundColor: A.surfaceRaised },
  avatarText: { color: A.primary, fontWeight: '800', fontSize: 18 },
  name: { fontSize: 19, fontWeight: '800', color: A.ink },
  sub: { fontSize: 14, color: A.muted, marginTop: 2, fontWeight: '600' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },

  leaveRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  leaveType: { fontSize: 16, fontWeight: '800', color: A.ink },
  days: { fontSize: 17, fontWeight: '800', color: A.primary },
  dateRange: { fontSize: 14, color: A.ink, fontWeight: '600', marginBottom: 4 },
  reason: { fontSize: 13, color: A.muted, fontStyle: 'italic', marginBottom: 10 },

  statRow: { flexDirection: 'row', gap: 8, marginBottom: 12, marginTop: 6 },
  statBox: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 10, backgroundColor: A.surfaceRaised },
  statValue: { fontSize: 18, fontWeight: '800', color: A.ink },
  statLabel: { fontSize: 10, color: A.muted, marginTop: 2, fontWeight: '600' },

  actionsRow: { flexDirection: 'row', gap: 10 },
  actionBtn: { flex: 1, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  detailsBtn: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: A.border },
  detailsText: { color: A.primary, fontWeight: '700', fontSize: 13 },
  rejectBtn: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#fca5a5' },
  rejectText: { color: '#b91c1c', fontWeight: '700', fontSize: 13 },
  approveBtn: { backgroundColor: '#15803d' },
  approveText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  changeBtn: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: A.border },
  changeText: { color: A.primary, fontWeight: '700', fontSize: 13 },
  undoBtn: { backgroundColor: '#fffbeb', borderWidth: 1.5, borderColor: '#fde68a' },
  undoText: { color: '#92400e', fontWeight: '700', fontSize: 13 },

  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: spacing(1) },
  pageBtn: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: A.surface, borderWidth: 1, borderColor: A.border },
  pageInfo: { fontSize: 12, color: A.muted, fontWeight: '600' },
});
