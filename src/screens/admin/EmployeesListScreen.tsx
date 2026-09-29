import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Icon from '../../components/Icon';
import { colors, radius, shadow, spacing } from '../../theme';
import { resolveFileUrl } from '../../utils/fileUrl';
import { useAdminNav } from '../../navigation/AdminShell';
import {
  EMPLOYEE_STATUS_FILTER_OPTIONS,
  EMPLOYMENT_STATUS_OPTIONS,
  EmployeeListItem,
  EmploymentStatusOption,
  getEmployees,
  updateEmployeeStatus,
} from '../../api/employeeApi';
import { usePermission } from '../../hooks/usePermission';

const A = colors.admin;
const PAGE_SIZE = 25;

function statusColor(status: string) {
  switch (status) {
    case 'Active':
      return { fg: '#15803d', bg: '#dcfce7' };
    case 'Trial':
      return { fg: '#a16207', bg: '#fef3c7' };
    case 'Inactive':
      return { fg: '#6b7280', bg: '#f3f4f6' };
    case 'Left':
    case 'Terminated':
      return { fg: '#b91c1c', bg: '#fee2e2' };
    default:
      return { fg: A.muted, bg: A.surfaceRaised };
  }
}

export default function EmployeesListScreen({ params }: { params?: { initialStatus?: string } }) {
  const { navigate } = useAdminNav();
  const [rows, setRows] = useState<EmployeeListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(params?.initialStatus || '');
  const [loading, setLoading] = useState(true);
  const [statusPickerFor, setStatusPickerFor] = useState<EmployeeListItem | null>(null);
  const [statusBusy, setStatusBusy] = useState(false);
  const canCreate = usePermission('Employee', 'Create');
  const canEdit = usePermission('Employee', 'Edit');

  const load = useCallback(async (p: number, s: string, st: string) => {
    setLoading(true);
    try {
      const res = await getEmployees({ page: p, pageSize: PAGE_SIZE, search: s || undefined, status: st || undefined });
      setRows(res.data.employees);
      setTotal(res.data.total);
      setTotalPages(res.data.totalPages);
      setPage(res.data.page);
    } catch {
      Alert.alert('Could not load employees');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(0, '', params?.initialStatus || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFilterStatus = (status: string) => {
    setStatusFilter(status);
    load(0, search, status);
  };

  const handleChangeStatus = async (status: EmploymentStatusOption) => {
    if (!statusPickerFor) return;
    setStatusBusy(true);
    try {
      await updateEmployeeStatus(statusPickerFor.employeeId, status);
      setStatusPickerFor(null);
      await load(page, search, statusFilter);
    } catch {
      Alert.alert('Could not update status', 'Please try again.');
    } finally {
      setStatusBusy(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.topRow}>
        <View style={styles.searchRow}>
          <Icon name="search" size={16} color={A.muted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search name, code, mobile..."
            placeholderTextColor={A.muted}
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={() => load(0, search, statusFilter)}
            returnKeyType="search"
          />
        </View>
        {canCreate && (
          <Pressable style={styles.addBtn} onPress={() => navigate('EmployeeForm', {})}>
            <Text style={styles.addBtnText}>+ Add</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.filterRow}>
        {['', ...EMPLOYEE_STATUS_FILTER_OPTIONS].map((s) => (
          <Pressable
            key={s || 'All'}
            style={[styles.filterChip, statusFilter === s && styles.filterChipActive]}
            onPress={() => handleFilterStatus(s)}
          >
            <Text style={[styles.filterChipText, statusFilter === s && styles.filterChipTextActive]}>{s || 'All'}</Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={A.primary} />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => String(r.employeeId)}
          contentContainerStyle={styles.content}
          ListHeaderComponent={<Text style={styles.countText}>{total} {statusFilter ? statusFilter.toLowerCase() : ''} employee{total === 1 ? '' : 's'}</Text>}
          ListEmptyComponent={<Text style={styles.emptyText}>No employees found.</Text>}
          ListFooterComponent={
            totalPages > 1 ? (
              <View style={styles.pagination}>
                <Pressable disabled={page <= 0} onPress={() => load(page - 1, search, statusFilter)} style={styles.pageBtn}>
                  <Icon name="chevronLeft" size={16} color={page <= 0 ? A.border : A.ink} />
                </Pressable>
                <Text style={styles.pageInfo}>
                  Page {page + 1} of {totalPages}
                </Text>
                <Pressable disabled={page >= totalPages - 1} onPress={() => load(page + 1, search, statusFilter)} style={styles.pageBtn}>
                  <Icon name="chevronRight" size={16} color={page >= totalPages - 1 ? A.border : A.ink} />
                </Pressable>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <Pressable style={styles.card} onPress={() => navigate('EmployeeForm', { employeeId: item.employeeId })}>
              {item.profilePictureUrl ? (
                <Image source={{ uri: resolveFileUrl(item.profilePictureUrl)! }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{item.employeeName.charAt(0).toUpperCase()}</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <View style={styles.nameRow}>
                  <Text style={styles.name} numberOfLines={1}>
                    {item.employeeName}
                  </Text>
                  <View style={[styles.statusBadge, { backgroundColor: statusColor(item.employmentStatus).bg }]}>
                    <Text style={[styles.statusBadgeText, { color: statusColor(item.employmentStatus).fg }]}>{item.employmentStatus}</Text>
                  </View>
                </View>
                <Text style={styles.sub} numberOfLines={1}>
                  {item.code} · {item.departmentName || 'No dept'} · {item.designationName || 'No designation'}
                </Text>
                <Text style={styles.sub} numberOfLines={1}>
                  {item.mobileNo}
                  {item.currentShiftName ? ` · ${item.currentShiftName}` : ''}
                </Text>
              </View>
              {!canEdit && <Icon name="chevronRight" size={16} color={A.muted} />}
              {canEdit && (
                <Pressable
                  style={styles.shiftBtn}
                  hitSlop={8}
                  onPress={() => navigate('AssignShift', { employeeId: item.employeeId, employeeName: item.employeeName, title: 'Assign Shift' })}
                >
                  <Icon name="calendar" size={16} color={A.primary} />
                </Pressable>
              )}
              {canEdit && (
                <Pressable style={styles.statusChangeBtn} hitSlop={8} onPress={() => setStatusPickerFor(item)}>
                  <Icon name="personCheck" size={16} color={A.primary} />
                </Pressable>
              )}
            </Pressable>
          )}
        />
      )}

      {statusPickerFor != null && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setStatusPickerFor(null)}>
          <Pressable style={styles.backdrop} onPress={() => setStatusPickerFor(null)}>
            <Pressable style={styles.statusSheet} onPress={() => {}}>
              <Text style={styles.statusSheetTitle}>{statusPickerFor.employeeName}</Text>
              <Text style={styles.statusSheetSub}>Change employment status</Text>
              {EMPLOYMENT_STATUS_OPTIONS.map((s) => (
                <Pressable
                  key={s}
                  style={[styles.statusOption, statusPickerFor.employmentStatus === s && styles.statusOptionActive]}
                  onPress={() => handleChangeStatus(s)}
                  disabled={statusBusy}
                >
                  <View style={[styles.statusDot, { backgroundColor: statusColor(s).fg }]} />
                  <Text style={styles.statusOptionText}>{s}</Text>
                  {statusPickerFor.employmentStatus === s && <Icon name="check" size={14} color={A.primary} />}
                </Pressable>
              ))}
              {statusBusy && <ActivityIndicator style={{ marginTop: 8 }} color={A.primary} />}
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: A.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing(2) },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: spacing(2), paddingBottom: 0 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: spacing(2), paddingTop: spacing(1.5) },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: A.border, backgroundColor: A.surface },
  filterChipActive: { backgroundColor: A.primary, borderColor: A.primary },
  filterChipText: { fontSize: 12, fontWeight: '700', color: A.muted },
  filterChipTextActive: { color: '#fff' },
  searchRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: A.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: A.border,
    paddingHorizontal: 12,
    height: 42,
  },
  searchInput: { flex: 1, fontSize: 14, color: A.ink },
  addBtn: { height: 42, paddingHorizontal: 16, borderRadius: radius.sm, backgroundColor: A.primary, alignItems: 'center', justifyContent: 'center' },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  countText: { color: A.muted, fontSize: 12, marginBottom: spacing(1.5) },
  emptyText: { color: A.muted, fontSize: 13, textAlign: 'center', marginTop: spacing(4) },

  card: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: A.surface, borderRadius: radius.md, padding: 12, marginBottom: 10, ...shadow.card },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: A.primary + '20', alignItems: 'center', justifyContent: 'center' },
  avatarImage: { width: 40, height: 40, borderRadius: 20, backgroundColor: A.surfaceRaised },
  avatarText: { color: A.primary, fontWeight: '800', fontSize: 16 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: 14, fontWeight: '800', color: A.ink, flexShrink: 1 },
  sub: { fontSize: 12, color: A.muted, marginTop: 2 },
  shiftBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: A.primary + '15' },
  statusChangeBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: A.primary + '15' },

  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  statusBadgeText: { fontSize: 9.5, fontWeight: '800' },

  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: spacing(1) },
  pageBtn: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: A.surface, borderWidth: 1, borderColor: A.border },
  pageInfo: { fontSize: 12, color: A.muted, fontWeight: '600' },

  backdrop: { flex: 1, backgroundColor: 'rgba(15,15,35,0.5)', justifyContent: 'center', padding: spacing(2) },
  statusSheet: { backgroundColor: A.surface, borderRadius: radius.md, padding: 16 },
  statusSheetTitle: { fontSize: 15, fontWeight: '800', color: A.ink },
  statusSheetSub: { fontSize: 12, color: A.muted, marginTop: 2, marginBottom: 12 },
  statusOption: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 10, borderRadius: radius.sm },
  statusOptionActive: { backgroundColor: A.surfaceRaised },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusOptionText: { flex: 1, fontSize: 13, fontWeight: '700', color: A.ink },
});
