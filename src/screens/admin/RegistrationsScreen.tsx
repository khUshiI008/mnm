import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Icon from '../../components/Icon';
import { colors, radius, shadow, spacing } from '../../theme';
import { approveRegistration, getRegistrations, PendingRegistration, rejectRegistration } from '../../api/employeeRegistrationApi';
import { usePermission } from '../../hooks/usePermission';
import { useAdminNav } from '../../navigation/AdminShell';

const A = colors.admin;
const PAGE_SIZE = 50;

export default function RegistrationsScreen({ params }: { params?: { employeeId?: number } }) {
  const [rows, setRows] = useState<PendingRegistration[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const canApprove = usePermission('EmployeeRegistration', 'Approve');
  const canReject = usePermission('EmployeeRegistration', 'Reject');
  const { navigate } = useAdminNav();
  const listRef = useRef<FlatList<PendingRegistration>>(null);
  // Set from a notification tap (e.g. "New Registration") — highlights and
  // scrolls to that specific employee's card once it's loaded, so tapping the
  // notification doesn't just dump the admin into a plain, unfiltered queue.
  const highlightEmployeeId = params?.employeeId;

  const load = useCallback(async (p: number, s: string) => {
    setLoading(true);
    try {
      const res = await getRegistrations({ page: p, pageSize: PAGE_SIZE, search: s || undefined });
      setRows(res.data.registrations);
      setTotal(res.data.total);
      setTotalPages(res.data.totalPages);
      setPage(res.data.page);
    } catch {
      Alert.alert('Could not load registrations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(0, search);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!highlightEmployeeId || !rows.length) return;
    const index = rows.findIndex((r) => r.employeeId === highlightEmployeeId);
    if (index >= 0) {
      const t = setTimeout(() => listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.3 }), 200);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [highlightEmployeeId, rows]);

  const runSearch = () => load(0, search);

  const handleApprove = (row: PendingRegistration) => {
    Alert.alert('Approve registration?', `${row.employeeName} will get full portal access.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Approve',
        onPress: async () => {
          setBusyId(row.employeeId);
          try {
            await approveRegistration(row.employeeId);
            await load(page, search);
            // Approving pulls the row out of this pending-only list right away, so both
            // next-step actions are offered on their own hub screen (not a one-shot alert,
            // where picking one would lose access to the other) — either can be done first,
            // and coming back from either lands here again to do the other.
            navigate('EmployeeApproved', { employeeId: row.employeeId, employeeName: row.employeeName, title: 'Employee Approved' });
          } catch {
            Alert.alert('Could not approve', 'Please try again.');
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  const handleReject = (row: PendingRegistration) => {
    Alert.alert('Reject registration?', `${row.employeeName} will be removed from the queue.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject',
        style: 'destructive',
        onPress: async () => {
          setBusyId(row.employeeId);
          try {
            await rejectRegistration(row.employeeId);
            await load(page, search);
          } catch {
            Alert.alert('Could not reject', 'Please try again.');
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.screen}>
      <View style={styles.searchRow}>
        <Icon name="search" size={16} color={A.muted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search name, code, mobile, email..."
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
          data={rows}
          keyExtractor={(r) => String(r.employeeId)}
          contentContainerStyle={styles.content}
          onScrollToIndexFailed={() => {}}
          ListHeaderComponent={<Text style={styles.trialCount}>{total} pending registration{total === 1 ? '' : 's'}</Text>}
          ListEmptyComponent={<Text style={styles.emptyText}>No pending registrations.</Text>}
          ListFooterComponent={
            totalPages > 1 ? (
              <View style={styles.pagination}>
                <Pressable disabled={page <= 0} onPress={() => load(page - 1, search)} style={styles.pageBtn}>
                  <Icon name="chevronLeft" size={16} color={page <= 0 ? A.border : A.ink} />
                </Pressable>
                <Text style={styles.pageInfo}>
                  Page {page + 1} of {totalPages}
                </Text>
                <Pressable disabled={page >= totalPages - 1} onPress={() => load(page + 1, search)} style={styles.pageBtn}>
                  <Icon name="chevronRight" size={16} color={page >= totalPages - 1 ? A.border : A.ink} />
                </Pressable>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <View style={[styles.card, item.employeeId === highlightEmployeeId && styles.cardHighlighted]}>
              <View style={styles.cardHeader}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{item.employeeName.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.employeeName}</Text>
                  <Text style={styles.code}>Code: {item.code}</Text>
                </View>
              </View>

              <View style={styles.metaGrid}>
                <MetaItem label="Mobile" value={item.mobileNo} />
                <MetaItem label="Email" value={item.email || '—'} />
                <MetaItem label="Gender" value={item.gender} />
                <MetaItem label="DOB" value={item.dobDisplay} />
                <MetaItem label="Organization" value={item.orgName} />
                <MetaItem label="Location" value={item.locName} />
                <MetaItem label="Department" value={item.deptName} />
                <MetaItem label="Registered" value={item.registeredOn} />
              </View>

              {(canReject || canApprove) && (
                <View style={styles.actionsRow}>
                  {canReject && (
                    <Pressable
                      style={[styles.actionBtn, styles.rejectBtn]}
                      onPress={() => handleReject(item)}
                      disabled={busyId === item.employeeId}
                    >
                      {busyId === item.employeeId ? <ActivityIndicator size="small" color="#b91c1c" /> : <Text style={styles.rejectText}>Reject</Text>}
                    </Pressable>
                  )}
                  {canApprove && (
                    <Pressable
                      style={[styles.actionBtn, styles.approveBtn]}
                      onPress={() => handleApprove(item)}
                      disabled={busyId === item.employeeId}
                    >
                      {busyId === item.employeeId ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.approveText}>Approve</Text>}
                    </Pressable>
                  )}
                </View>
              )}
            </View>
          )}
        />
      )}
    </View>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaItem}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: A.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing(2) },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    margin: spacing(2),
    marginBottom: 0,
    backgroundColor: A.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: A.border,
    paddingHorizontal: 12,
    height: 42,
  },
  searchInput: { flex: 1, fontSize: 14, color: A.ink },
  trialCount: { color: A.muted, fontSize: 12, marginBottom: spacing(1.5) },
  emptyText: { color: A.muted, fontSize: 13, textAlign: 'center', marginTop: spacing(4) },

  card: { backgroundColor: A.surface, borderRadius: radius.md, padding: 14, marginBottom: 12, ...shadow.card },
  cardHighlighted: { borderWidth: 2, borderColor: A.primary },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: A.primary + '20', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: A.primary, fontWeight: '800', fontSize: 16 },
  name: { fontSize: 15, fontWeight: '800', color: A.ink },
  code: { fontSize: 12, color: A.muted, marginTop: 1 },

  metaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  metaItem: { width: '47%' },
  metaLabel: { fontSize: 10, color: A.muted, textTransform: 'uppercase', fontWeight: '700' },
  metaValue: { fontSize: 13, color: A.ink, marginTop: 2, fontWeight: '500' },

  actionsRow: { flexDirection: 'row', gap: 10 },
  actionBtn: { flex: 1, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rejectBtn: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#fca5a5' },
  rejectText: { color: '#b91c1c', fontWeight: '700', fontSize: 13 },
  approveBtn: { backgroundColor: '#15803d' },
  approveText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: spacing(1) },
  pageBtn: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: A.surface, borderWidth: 1, borderColor: A.border },
  pageInfo: { fontSize: 12, color: A.muted, fontWeight: '600' },
});
