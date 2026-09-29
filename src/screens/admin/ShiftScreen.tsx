import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import ShiftFormModal from '../../components/admin/ShiftFormModal';
import { colors, radius, shadow, spacing } from '../../theme';
import { deleteShift, getShifts, ShiftRow } from '../../api/adminShiftApi';

const A = colors.admin;

export default function ShiftScreen() {
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<ShiftRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [formTarget, setFormTarget] = useState<{ row?: ShiftRow } | null>(null);

  const load = useCallback(async (term?: string) => {
    setLoading(true);
    try {
      const res = await getShifts(term);
      setRows(res.data.shifts);
    } catch {
      Alert.alert('Could not load shifts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = (row: ShiftRow) => {
    Alert.alert('Archive this shift?', `${row.shiftName} will be archived. Employees currently assigned will keep their history.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Archive',
        style: 'destructive',
        onPress: async () => {
          setBusyId(row.shiftId);
          try {
            await deleteShift(row.shiftId);
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
          placeholder="Search shift name..."
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
          <Text style={styles.countText}>{rows.length} shifts</Text>
          {rows.length === 0 ? (
            <Text style={styles.emptyText}>No shifts found. Tap Add to create the first one.</Text>
          ) : (
            rows.map((row) => (
              <View key={row.shiftId} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{row.shiftName}</Text>
                    <Text style={styles.sub}>
                      {row.startTimeDisplay} – {row.endTimeDisplay} · {row.durationDisplay}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, row.status !== 'Active' && styles.statusBadgeInactive]}>
                    <Text style={[styles.statusBadgeText, row.status !== 'Active' && styles.statusBadgeTextInactive]}>{row.status}</Text>
                  </View>
                </View>

                <Text style={styles.detailLine}>{row.requiredWorkingDisplay} · Break {row.breakDurationMinutes}m</Text>
                <Text style={styles.detailLine}>
                  Grace {row.graceTimeMinutes}m ({row.graceOccurrencesPerMonth}/mo){row.lateChargeAmount ? ` · Late charge ₹${row.lateChargeAmount}` : ''}
                </Text>
                <Text style={styles.detailLine}>
                  {row.earlyGoingAllowed ? 'Early going allowed' : 'Early going not allowed'} · OT {row.otApplicable ? `applicable (buffer ${row.otBufferMinutes}m)` : 'not applicable'}
                </Text>
                <Text style={styles.empCount}>{row.activeEmployeeCount} active employee{row.activeEmployeeCount === 1 ? '' : 's'}</Text>

                <View style={styles.actionsRow}>
                  <Pressable style={[styles.actionBtn, styles.editBtn]} onPress={() => setFormTarget({ row })}>
                    <Text style={styles.editText}>Edit</Text>
                  </Pressable>
                  <Pressable style={[styles.actionBtn, styles.deleteBtn]} onPress={() => handleDelete(row)} disabled={busyId === row.shiftId}>
                    {busyId === row.shiftId ? <ActivityIndicator size="small" color="#b91c1c" /> : <Text style={styles.deleteText}>Archive</Text>}
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {formTarget && (
        <ShiftFormModal
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
  statusBadge: { backgroundColor: '#dcfce7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  statusBadgeText: { fontSize: 10, fontWeight: '700', color: '#15803d' },
  statusBadgeInactive: { backgroundColor: '#f1f5f9' },
  statusBadgeTextInactive: { color: A.muted },
  detailLine: { fontSize: 12, color: A.muted, marginTop: 2 },
  empCount: { fontSize: 12, fontWeight: '700', color: A.primary, marginTop: 6 },

  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionBtn: { flexGrow: 1, height: 38, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  editBtn: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: A.border },
  editText: { color: A.ink, fontWeight: '700', fontSize: 12 },
  deleteBtn: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#fca5a5' },
  deleteText: { color: '#b91c1c', fontWeight: '700', fontSize: 12 },
});
