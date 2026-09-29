import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Linking, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Icon from '../../components/Icon';
import { Picker } from '../../components/AppPicker';
import { colors, radius, spacing } from '../../theme';
import { resolveFileUrl } from '../../utils/fileUrl';
import AttendanceCalendarModal from '../../components/admin/AttendanceCalendarModal';
import CheckInSelfieViewerModal from '../../components/admin/CheckInSelfieViewerModal';
import ProfilePictureViewerModal from '../../components/admin/ProfilePictureViewerModal';
import LeaveDecisionModal, { LeaveDecisionOption, LeaveDecisionStatus } from '../../components/admin/LeaveDecisionModal';
import LeaveConflictModal, { LeaveConflictData } from '../../components/admin/LeaveConflictModal';
import DateField from '../../components/DateField';
import Button from '../../components/Button';
import { EmployeePhotoInfo, getEmployeePhotos } from '../../api/adminDashboardApi';
import { EMPLOYMENT_STATUS_OPTIONS, updateEmployeeStatus } from '../../api/employeeApi';
import { adminApproveLeave, adminCancelLeave, adminRejectLeave, changeLeaveDecision, checkApprovalConflict, markLeaveQuick } from '../../api/adminLeaveApi';

const A = colors.admin;

export type NotYetComeLeave = {
  leaveApplicationId: number;
  status: string;
  leaveTypeName: string;
  fromDateDisplay: string;
  toDateDisplay: string;
};

export type DrillDownRow = {
  name: string;
  sub?: string;
  employeeId?: number;
  badge?: string;
  phone?: string;
  department?: string;
  designation?: string;
  leave?: NotYetComeLeave;
};

const ALL_LEAVE_DECISIONS: LeaveDecisionOption[] = [
  { label: 'Approve', value: 'Approved' },
  { label: 'Reject', value: 'Rejected' },
  { label: 'Cancel Leave', value: 'Cancelled' },
];

const LEAVE_STATUS_COLOR: Record<string, string> = { Pending: '#d97706', Approved: '#15803d', Rejected: '#b91c1c', Cancelled: '#6b7280' };

/**
 * Generic filtered-employee-list screen behind every Dashboard KPI card /
 * department box tap. Deliberately not a pixel-port of .NET's per-card modal
 * layouts (11+ different ones) — shows name + one relevant stat per row,
 * which is what actually matters when checking who's in a given bucket.
 *
 * Rows for the "Not Yet Come" list additionally carry `leave` (see
 * adminDashboardService.js) so a still-pending leave application blocking
 * that employee's attendance can be approved/rejected right from here, and a
 * "Change Status" menu (wired to PATCH /employees/:id/status) is available
 * on every row. Not Yet Come rows with no leave at all also get a "Mark
 * Leave" quick action — a simplified "apply leave on behalf" for the
 * emergency-call scenario: admin picks a From/Till date range (defaulting to
 * the dashboard's selected date), the only active leave type is used, and
 * it's always immediately Approved regardless of remaining balance — an
 * admin marking this is a deliberate call, not a request awaiting sign-off.
 * Approved leave is never shown here at all — those employees are excluded
 * from this list entirely on the backend.
 */
export default function DrillDownListScreen({ params }: { params?: { title: string; rows: DrillDownRow[]; selectedDate?: string } }) {
  // Title itself renders in AdminShell's topbar (params.title) — nothing to show twice here.
  const [rows, setRows] = useState<DrillDownRow[]>(params?.rows || []);
  // Only "Arrived Today" gets a check-in-selfie thumbnail on the left avatar circle.
  const isArrivedToday = params?.title === 'Arrived Today';
  // Only the Not Yet Come list gets the "Mark Leave" quick action — marking
  // leave for someone who's already arrived/working doesn't make sense.
  const isNotYetCome = params?.title === 'Not Yet Come';
  const selectedDate = params?.selectedDate;
  const [calendarEmpId, setCalendarEmpId] = useState<number | null>(null);
  const [selfieEmpId, setSelfieEmpId] = useState<number | null>(null);
  const [profileEmpId, setProfileEmpId] = useState<number | null>(null);
  const [photos, setPhotos] = useState<Record<number, EmployeePhotoInfo>>({});
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [desigFilter, setDesigFilter] = useState('');

  const [statusMenuEmpId, setStatusMenuEmpId] = useState<number | null>(null);
  const [savingStatusId, setSavingStatusId] = useState<number | null>(null);

  const [busyLeaveId, setBusyLeaveId] = useState<number | null>(null);
  const [decisionTarget, setDecisionTarget] = useState<{ id: number; empName: string; shortCode: string } | null>(null);
  const [decisionMode, setDecisionMode] = useState<'reject' | 'change' | 'undo'>('reject');
  const [decisionCurrentStatus, setDecisionCurrentStatus] = useState<string | null>(null);
  const [detailsData, setDetailsData] = useState<LeaveConflictData | null>(null);
  const [detailsBusyId, setDetailsBusyId] = useState<number | null>(null);
  const [markLeaveTarget, setMarkLeaveTarget] = useState<{ employeeId: number; name: string } | null>(null);
  const [markLeaveFrom, setMarkLeaveFrom] = useState('');
  const [markLeaveTo, setMarkLeaveTo] = useState('');
  const [markLeaveBusy, setMarkLeaveBusy] = useState(false);

  const departmentOptions = useMemo(
    () => [...new Set(rows.map((r) => r.department).filter((d): d is string => !!d))].sort((a, b) => a.localeCompare(b)),
    [rows]
  );
  const designationOptions = useMemo(
    () => [...new Set(rows.map((r) => r.designation).filter((d): d is string => !!d))].sort((a, b) => a.localeCompare(b)),
    [rows]
  );

  // Camera icon opens the profile picture on every list, not just "Arrived
  // Today" — one bulk call for the whole list instead of a request per row.
  // Today's check-in-selfie thumbnail on the left circle is still
  // Arrived-Today-only (any other list's "today" selfie wouldn't mean
  // anything), but the same response already carries profilePictureUrl for
  // everyone, so no separate fetch is needed for the camera-icon case.
  // Fetched once from the initial row set — `rows` is now local state (it
  // changes on every status/leave action below), so re-running this on every
  // `rows` change would refetch photos after each optimistic update.
  useEffect(() => {
    const employeeIds = rows.map((r) => r.employeeId).filter((id): id is number => !!id);
    if (!employeeIds.length) return;
    let cancelled = false;
    getEmployeePhotos(employeeIds)
      .then((res) => {
        if (!cancelled) setPhotos(res.data.employees);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live, no-debounce substring filter over the already-loaded rows — mirrors
  // Panel/Dashboard.aspx's dashApplyTableVisibility() per-KPI-modal search.
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (deptFilter && r.department !== deptFilter) return false;
      if (desigFilter && r.designation !== desigFilter) return false;
      if (q && !`${r.name} ${r.sub || ''} ${r.phone || ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, search, deptFilter, desigFilter]);

  const updateRow = (employeeId: number, patch: Partial<DrillDownRow>) => {
    setRows((prev) => prev.map((r) => (r.employeeId === employeeId ? { ...r, ...patch } : r)));
  };

  const removeRow = (employeeId: number) => {
    setRows((prev) => prev.filter((r) => r.employeeId !== employeeId));
  };

  const handleChangeStatus = (row: DrillDownRow, status: string) => {
    if (!row.employeeId) return;
    setStatusMenuEmpId(null);
    Alert.alert('Change employment status?', `Set ${row.name}'s status to "${status}".`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        onPress: async () => {
          setSavingStatusId(row.employeeId!);
          try {
            await updateEmployeeStatus(row.employeeId!, status as any);
            // The dashboard only ever lists Active employees, so once a row
            // is set to anything else it no longer belongs in this list.
            if (status === 'Active') Alert.alert('Status updated', `${row.name} is now Active.`);
            else removeRow(row.employeeId!);
          } catch (err: any) {
            Alert.alert('Could not update status', err?.response?.data?.message || 'Please try again.');
          } finally {
            setSavingStatusId(null);
          }
        },
      },
    ]);
  };

  const handleApproveLeave = (row: DrillDownRow) => {
    if (!row.leave) return;
    const leave = row.leave;
    Alert.alert('Approve leave?', `${row.name}'s ${leave.leaveTypeName} request.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Approve',
        onPress: async () => {
          setBusyLeaveId(leave.leaveApplicationId);
          try {
            await adminApproveLeave(leave.leaveApplicationId);
            updateRow(row.employeeId!, { leave: { ...leave, status: 'Approved' } });
          } catch (err: any) {
            Alert.alert('Could not approve', err?.response?.data?.message || 'Please try again.');
          } finally {
            setBusyLeaveId(null);
          }
        },
      },
    ]);
  };

  const openReject = (row: DrillDownRow) => {
    if (!row.leave || !row.employeeId) return;
    setDecisionMode('reject');
    setDecisionCurrentStatus(row.leave.status);
    setDecisionTarget({ id: row.leave.leaveApplicationId, empName: row.name, shortCode: row.leave.leaveTypeName });
  };

  const openChangeDecision = (row: DrillDownRow) => {
    if (!row.leave || !row.employeeId) return;
    setDecisionMode('change');
    setDecisionCurrentStatus(row.leave.status);
    setDecisionTarget({ id: row.leave.leaveApplicationId, empName: row.name, shortCode: row.leave.leaveTypeName });
  };

  // "Undo" — for when Approve was actioned by mistake. Moves the application
  // straight back to Pending, same as LeaveAdminScreen's Undo button.
  const openUndo = (row: DrillDownRow) => {
    if (!row.leave || !row.employeeId) return;
    setDecisionMode('undo');
    setDecisionCurrentStatus(row.leave.status);
    setDecisionTarget({ id: row.leave.leaveApplicationId, empName: row.name, shortCode: row.leave.leaveTypeName });
  };

  const handleViewDetails = async (row: DrillDownRow) => {
    if (!row.leave) return;
    const leave = row.leave;
    setDetailsBusyId(leave.leaveApplicationId);
    try {
      const res = await checkApprovalConflict(leave.leaveApplicationId);
      setDetailsData({
        empName: row.name,
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

  const openMarkLeave = (row: DrillDownRow) => {
    if (!row.employeeId) return;
    setMarkLeaveTarget({ employeeId: row.employeeId, name: row.name });
    setMarkLeaveFrom(selectedDate || '');
    setMarkLeaveTo(selectedDate || '');
  };

  const submitMarkLeave = async () => {
    if (!markLeaveTarget || !markLeaveFrom || !markLeaveTo) return;
    if (new Date(markLeaveTo) < new Date(markLeaveFrom)) {
      Alert.alert('Invalid range', 'Till date cannot be before the From date.');
      return;
    }
    setMarkLeaveBusy(true);
    try {
      const res = await markLeaveQuick(markLeaveTarget.employeeId, markLeaveFrom, markLeaveTo);
      if (res.data.success) {
        removeRow(markLeaveTarget.employeeId);
        setMarkLeaveTarget(null);
        Alert.alert('Leave marked', res.data.message);
      } else {
        Alert.alert('Could not mark leave', res.data.message);
      }
    } catch (err: any) {
      Alert.alert('Could not mark leave', err?.response?.data?.message || 'Please try again.');
    } finally {
      setMarkLeaveBusy(false);
    }
  };

  const handleCancelLeave = (row: DrillDownRow) => {
    if (!row.leave || !row.employeeId) return;
    const leave = row.leave;
    Alert.alert('Cancel leave?', `${row.name}'s ${leave.leaveTypeName} request will be withdrawn.`, [
      { text: 'No', style: 'cancel' },
      {
        text: 'Cancel Leave',
        style: 'destructive',
        onPress: async () => {
          setBusyLeaveId(leave.leaveApplicationId);
          try {
            await adminCancelLeave(leave.leaveApplicationId);
            updateRow(row.employeeId!, { leave: { ...leave, status: 'Cancelled' } });
          } catch (err: any) {
            Alert.alert('Could not cancel', err?.response?.data?.message || 'Please try again.');
          } finally {
            setBusyLeaveId(null);
          }
        },
      },
    ]);
  };

  const decisionOptions: LeaveDecisionOption[] =
    decisionMode === 'reject'
      ? [{ label: 'Reject', value: 'Rejected' }]
      : decisionMode === 'undo'
      ? [{ label: 'Undo', value: 'Pending' as LeaveDecisionStatus }]
      : ALL_LEAVE_DECISIONS.filter((o) => o.value !== decisionCurrentStatus);

  const submitDecision = async (newStatus: LeaveDecisionStatus, remarks: string) => {
    if (!decisionTarget) return;
    setBusyLeaveId(decisionTarget.id);
    try {
      if (decisionMode === 'reject') {
        await adminRejectLeave(decisionTarget.id, remarks);
      } else {
        await changeLeaveDecision(decisionTarget.id, newStatus, remarks);
      }
      const row = rows.find((r) => r.leave?.leaveApplicationId === decisionTarget.id);
      if (row?.employeeId && row.leave) updateRow(row.employeeId, { leave: { ...row.leave, status: newStatus } });
      setDecisionTarget(null);
    } catch (err: any) {
      Alert.alert('Could not save', err?.response?.data?.message || 'Please try again.');
    } finally {
      setBusyLeaveId(null);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.searchRow}>
        <Icon name="search" size={16} color={A.muted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search name / dept / code..."
          placeholderTextColor={A.muted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {(departmentOptions.length > 0 || designationOptions.length > 0) && (
        <View style={styles.filterRow}>
          {departmentOptions.length > 0 && (
            <View style={styles.filterPickerWrap}>
              <Picker selectedValue={deptFilter} onValueChange={(v) => setDeptFilter(String(v))} style={styles.filterPicker}>
                <Picker.Item label="All Departments" value="" />
                {departmentOptions.map((d) => (
                  <Picker.Item key={d} label={d} value={d} />
                ))}
              </Picker>
            </View>
          )}
          {designationOptions.length > 0 && (
            <View style={styles.filterPickerWrap}>
              <Picker selectedValue={desigFilter} onValueChange={(v) => setDesigFilter(String(v))} style={styles.filterPicker}>
                <Picker.Item label="All Designations" value="" />
                {designationOptions.map((d) => (
                  <Picker.Item key={d} label={d} value={d} />
                ))}
              </Picker>
            </View>
          )}
        </View>
      )}

      <FlatList
        data={filteredRows}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <Text style={styles.headerText}>
            {rows.length} {rows.length === 1 ? 'record' : 'records'}
          </Text>
        }
        ListEmptyComponent={<Text style={styles.emptyText}>{rows.length === 0 ? 'Nothing here.' : 'No matches for your filters.'}</Text>}
        renderItem={({ item }) => {
          const selfieUrl = isArrivedToday && item.employeeId ? photos[item.employeeId]?.checkIn?.url : undefined;
          const leave = item.leave;
          return (
            <View style={styles.rowCard}>
              <Pressable style={styles.row} onPress={() => item.employeeId && setCalendarEmpId(item.employeeId)} disabled={!item.employeeId}>
                {/* Left circle: today's check-in selfie when available (tap → full picture + location), initials otherwise. */}
                <Pressable
                  style={styles.avatar}
                  disabled={!selfieUrl}
                  onPress={() => selfieUrl && setSelfieEmpId(item.employeeId!)}
                >
                  {selfieUrl ? (
                    <Image source={{ uri: resolveFileUrl(selfieUrl)! }} style={styles.avatarImg} />
                  ) : (
                    <Text style={styles.avatarText}>{(item.name || '?').charAt(0).toUpperCase()}</Text>
                  )}
                </Pressable>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.name}</Text>
                  {item.sub ? <Text style={styles.sub}>{item.sub}</Text> : null}
                  {item.phone ? <Text style={styles.sub}>{item.phone}</Text> : null}
                </View>
                {item.badge ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{item.badge}</Text>
                  </View>
                ) : null}
                {item.phone ? (
                  <Pressable style={styles.selfieBtn} hitSlop={8} onPress={() => Linking.openURL(`tel:${item.phone}`)}>
                    <Icon name="phone" size={16} color={A.muted} />
                  </Pressable>
                ) : null}
                {item.employeeId ? (
                  <Pressable style={styles.selfieBtn} hitSlop={8} onPress={() => setProfileEmpId(item.employeeId!)}>
                    <Icon name="camera" size={16} color={A.muted} />
                  </Pressable>
                ) : null}
                {item.employeeId ? (
                  <Pressable
                    style={styles.selfieBtn}
                    hitSlop={8}
                    onPress={() => setStatusMenuEmpId(item.employeeId!)}
                    disabled={savingStatusId === item.employeeId}
                  >
                    {savingStatusId === item.employeeId ? (
                      <ActivityIndicator size="small" color={A.muted} />
                    ) : (
                      <Icon name="gear" size={16} color={A.muted} />
                    )}
                  </Pressable>
                ) : null}
              </Pressable>

              {isNotYetCome && item.employeeId && !leave && selectedDate && (
                <View style={styles.leaveBar}>
                  <Pressable style={[styles.leaveBtn, styles.markLeaveBtn]} onPress={() => openMarkLeave(item)}>
                    <Text style={styles.markLeaveText}>Mark Leave</Text>
                  </Pressable>
                </View>
              )}

              {leave && (
                <View style={styles.leaveBar}>
                  <View style={[styles.leaveChip, { backgroundColor: (LEAVE_STATUS_COLOR[leave.status] || A.muted) + '1f' }]}>
                    <Text style={[styles.leaveChipText, { color: LEAVE_STATUS_COLOR[leave.status] || A.muted }]}>
                      {leave.leaveTypeName} · {leave.status}
                    </Text>
                  </View>
                  {leave.status === 'Pending' ? (
                    <View style={styles.leaveActions}>
                      <Pressable style={[styles.leaveBtn, styles.detailsBtn]} onPress={() => handleViewDetails(item)} disabled={detailsBusyId === leave.leaveApplicationId}>
                        {detailsBusyId === leave.leaveApplicationId ? <ActivityIndicator size="small" color={A.primary} /> : <Text style={styles.detailsText}>Details</Text>}
                      </Pressable>
                      <Pressable style={[styles.leaveBtn, styles.rejectBtn]} onPress={() => openReject(item)} disabled={busyLeaveId === leave.leaveApplicationId}>
                        <Text style={styles.rejectText}>Reject</Text>
                      </Pressable>
                      <Pressable style={[styles.leaveBtn, styles.approveBtn]} onPress={() => handleApproveLeave(item)} disabled={busyLeaveId === leave.leaveApplicationId}>
                        {busyLeaveId === leave.leaveApplicationId ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.approveText}>Approve</Text>}
                      </Pressable>
                      <Pressable style={[styles.leaveBtn, styles.cancelBtn]} onPress={() => handleCancelLeave(item)} disabled={busyLeaveId === leave.leaveApplicationId}>
                        <Text style={styles.cancelText}>Cancel</Text>
                      </Pressable>
                    </View>
                  ) : leave.status === 'Approved' ? (
                    <View style={styles.leaveActions}>
                      <Pressable style={[styles.leaveBtn, styles.undoBtn]} onPress={() => openUndo(item)} disabled={busyLeaveId === leave.leaveApplicationId}>
                        {busyLeaveId === leave.leaveApplicationId ? <ActivityIndicator size="small" color="#92400e" /> : <Text style={styles.undoText}>Undo</Text>}
                      </Pressable>
                      <Pressable style={[styles.leaveBtn, styles.changeBtn]} onPress={() => openChangeDecision(item)} disabled={busyLeaveId === leave.leaveApplicationId}>
                        {busyLeaveId === leave.leaveApplicationId ? <ActivityIndicator size="small" color={A.primary} /> : <Text style={styles.changeText}>Change Decision</Text>}
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              )}
            </View>
          );
        }}
      />

      {calendarEmpId != null && <AttendanceCalendarModal visible employeeId={calendarEmpId} onClose={() => setCalendarEmpId(null)} />}
      {selfieEmpId != null && isArrivedToday && (
        <CheckInSelfieViewerModal visible employeeId={selfieEmpId} onClose={() => setSelfieEmpId(null)} />
      )}
      {profileEmpId != null && (
        <ProfilePictureViewerModal
          visible
          employeeName={rows.find((r) => r.employeeId === profileEmpId)?.name || ''}
          profilePictureUrl={photos[profileEmpId]?.profilePictureUrl ?? null}
          onClose={() => setProfileEmpId(null)}
        />
      )}

      <Modal visible={statusMenuEmpId != null} transparent animationType="fade" onRequestClose={() => setStatusMenuEmpId(null)}>
        <Pressable style={styles.backdrop} onPress={() => setStatusMenuEmpId(null)}>
          <Pressable style={styles.statusBox} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.statusTitle}>Change Employment Status</Text>
            <Text style={styles.statusSubtitle}>{rows.find((r) => r.employeeId === statusMenuEmpId)?.name}</Text>
            <View style={styles.statusChips}>
              {EMPLOYMENT_STATUS_OPTIONS.map((s) => (
                <Pressable
                  key={s}
                  style={styles.statusChip}
                  onPress={() => {
                    const row = rows.find((r) => r.employeeId === statusMenuEmpId);
                    if (row) handleChangeStatus(row, s);
                  }}
                >
                  <Text style={styles.statusChipText}>{s}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable style={styles.statusCancelBtn} onPress={() => setStatusMenuEmpId(null)}>
              <Text style={styles.statusCancelText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <LeaveConflictModal data={detailsData} busy={false} mode="details" onClose={() => setDetailsData(null)} />

      <LeaveDecisionModal
        target={decisionTarget}
        title={
          decisionMode === 'reject'
            ? `Reject ${decisionTarget?.empName}'s ${decisionTarget?.shortCode} request?`
            : decisionMode === 'undo'
            ? `Undo ${decisionTarget?.empName}'s ${decisionTarget?.shortCode} decision? It'll go back to Pending.`
            : `Change decision for ${decisionTarget?.empName}'s ${decisionTarget?.shortCode} request`
        }
        options={decisionOptions}
        busy={busyLeaveId === decisionTarget?.id}
        onClose={() => setDecisionTarget(null)}
        onSubmit={submitDecision}
      />

      <Modal visible={markLeaveTarget != null} transparent animationType="fade" onRequestClose={() => setMarkLeaveTarget(null)}>
        <Pressable style={styles.backdrop} onPress={() => setMarkLeaveTarget(null)}>
          <Pressable style={styles.statusBox} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.statusTitle}>Mark Leave</Text>
            <Text style={styles.statusSubtitle}>
              {markLeaveTarget?.name} — use this only for a genuine emergency (e.g. they called in). Approved immediately.
            </Text>
            <DateField label="From Date" granularity="day" value={markLeaveFrom} onChange={setMarkLeaveFrom} placeholder="Select date" />
            <DateField label="Till Date" granularity="day" value={markLeaveTo} onChange={setMarkLeaveTo} placeholder="Select date" />
            <View style={styles.modalActions}>
              <Button title="Cancel" variant="outline" onPress={() => setMarkLeaveTarget(null)} style={{ flex: 1 }} />
              <Button title="Mark Leave" onPress={submitMarkLeave} loading={markLeaveBusy} style={{ flex: 1 }} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: A.bg },
  content: { padding: spacing(2) },
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
    margin: spacing(2),
    marginBottom: 0,
  },
  searchInput: { flex: 1, fontSize: 14, color: A.ink },
  filterRow: { flexDirection: 'row', gap: 8, marginHorizontal: spacing(2), marginTop: spacing(1) },
  filterPickerWrap: { flex: 1, borderWidth: 1, borderColor: A.border, borderRadius: radius.sm, backgroundColor: A.surface },
  filterPicker: { fontSize: 12 },
  headerText: { color: A.muted, fontSize: 12, marginBottom: spacing(1) },
  emptyText: { color: A.muted, fontSize: 13, textAlign: 'center', marginTop: spacing(4) },
  rowCard: {
    backgroundColor: A.surface,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: A.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1.5),
    padding: 12,
  },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: A.primary + '20', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImg: { width: 36, height: 36, borderRadius: 18 },
  selfieBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: A.bg },
  avatarText: { color: A.primary, fontWeight: '800', fontSize: 14 },
  name: { fontSize: 14, fontWeight: '700', color: A.ink },
  sub: { fontSize: 12, color: A.muted, marginTop: 2 },
  badge: { backgroundColor: '#fef3c7', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, marginRight: 4 },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#92400e' },

  leaveBar: { paddingHorizontal: 12, paddingBottom: 12, borderTopWidth: 1, borderTopColor: A.border, paddingTop: 10 },
  leaveChip: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 6 },
  leaveChipText: { fontSize: 11, fontWeight: '700' },
  leaveActions: { flexDirection: 'row', gap: 8 },
  leaveBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderRadius: 8 },
  detailsBtn: { backgroundColor: '#fff', borderWidth: 1, borderColor: A.border },
  detailsText: { color: A.primary, fontWeight: '700', fontSize: 12 },
  rejectBtn: { backgroundColor: '#fee2e2' },
  rejectText: { color: '#b91c1c', fontWeight: '700', fontSize: 12 },
  approveBtn: { backgroundColor: '#15803d' },
  approveText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  cancelBtn: { backgroundColor: A.bg, borderWidth: 1, borderColor: A.border },
  cancelText: { color: A.muted, fontWeight: '700', fontSize: 12 },
  undoBtn: { backgroundColor: '#fef3c7' },
  undoText: { color: '#92400e', fontWeight: '700', fontSize: 12 },
  markLeaveBtn: { backgroundColor: '#fef3c7', borderWidth: 1, borderColor: '#fde68a' },
  markLeaveText: { color: '#92400e', fontWeight: '700', fontSize: 12 },
  changeBtn: { backgroundColor: A.primary + '1a' },
  changeText: { color: A.primary, fontWeight: '700', fontSize: 12 },

  backdrop: { flex: 1, backgroundColor: 'rgba(15,13,35,0.5)', alignItems: 'center', justifyContent: 'center', padding: spacing(3) },
  statusBox: { width: '100%', backgroundColor: A.surface, borderRadius: radius.md, padding: spacing(2.5) },
  statusTitle: { fontSize: 15, fontWeight: '800', color: A.ink },
  statusSubtitle: { fontSize: 12, color: A.muted, marginBottom: spacing(1.5) },
  statusChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing(1.5) },
  statusChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, borderWidth: 1.5, borderColor: A.border, backgroundColor: A.bg },
  statusChipText: { fontSize: 13, fontWeight: '700', color: A.ink },
  statusCancelBtn: { alignItems: 'center', paddingVertical: 10 },
  statusCancelText: { color: A.muted, fontWeight: '600', fontSize: 13 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: spacing(1) },
});
