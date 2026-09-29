import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, shadow, spacing } from '../../theme';
import { useAdminNav } from '../../navigation/AdminShell';
import { getBarcodeTargets, deleteBarcodeTarget, BarcodeTargetGridItem } from '../../api/adminBarcodeTargetApi';

const A = colors.admin;

function money(n: number) {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}
function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Node port of Panel/Sales/BarcodeTarget/Index.aspx's list tab — reached via TargetGenerateScreen's "Barcode Target" button. */
export default function BarcodeTargetListScreen() {
  const { navigate } = useAdminNav();
  const [rows, setRows] = useState<BarcodeTargetGridItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getBarcodeTargets();
      setRows(res.data.targets);
    } catch {
      Alert.alert('Could not load Barcode Targets');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = (row: BarcodeTargetGridItem) => {
    Alert.alert('Delete this Barcode Target?', 'It will be archived and hidden from active lists.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setBusyId(row.barcodeTargetId);
          try {
            await deleteBarcodeTarget(row.barcodeTargetId);
            await load();
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
      <View style={styles.topRow}>
        <Text style={styles.countText}>{rows.length} barcode target(s)</Text>
        <Pressable style={styles.addBtn} onPress={() => navigate('BarcodeTargetForm', { title: 'Add Barcode Target' })}>
          <Text style={styles.addBtnText}>+ Add</Text>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={A.primary} style={styles.loader} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {rows.length === 0 ? (
            <Text style={styles.emptyText}>No Barcode Targets found. Tap Add to create the first one.</Text>
          ) : (
            rows.map((row) => (
              <Pressable
                key={row.barcodeTargetId}
                style={styles.card}
                onPress={() => navigate('BarcodeTargetForm', { barcodeTargetId: row.barcodeTargetId, title: 'Edit Barcode Target' })}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.name} numberOfLines={1}>
                    {row.brandNames.length ? row.brandNames.join(', ') : 'All brands'}
                  </Text>
                  {row.isClosed && <Text style={styles.closedPill}>Closed</Text>}
                </View>
                <Text style={styles.sub}>
                  From {formatDate(row.effectiveFrom)}
                  {row.effectiveTo ? ` to ${formatDate(row.effectiveTo)}` : ''}
                </Text>
                <View style={styles.statsRow}>
                  <Text style={styles.statChip}>{row.barcodeCount} barcode(s)</Text>
                  <Text style={styles.statChip}>Emp: {money(row.pcsAmount)}/pc</Text>
                  {row.managerPcsAmount != null && <Text style={styles.statChip}>Mgr: {money(row.managerPcsAmount)}/pc</Text>}
                  <Text style={styles.statChip}>
                    {row.employees.length} emp · {row.managers.length} mgr
                  </Text>
                  {row.conflictCount > 0 && <Text style={styles.conflictChip}>{row.conflictCount} conflict(s)</Text>}
                </View>

                <View style={styles.actionsRow}>
                  <Pressable
                    style={[styles.actionBtn, styles.editBtn]}
                    onPress={() => navigate('BarcodeTargetForm', { barcodeTargetId: row.barcodeTargetId, title: 'Edit Barcode Target' })}
                  >
                    <Text style={styles.editText}>Edit</Text>
                  </Pressable>
                  {row.conflictCount > 0 && (
                    <Pressable
                      style={[styles.actionBtn, styles.conflictBtn]}
                      onPress={() => navigate('BarcodeTargetConflicts', { barcodeTargetId: row.barcodeTargetId, title: 'Conflicts' })}
                    >
                      <Text style={styles.conflictText}>Conflicts ({row.conflictCount})</Text>
                    </Pressable>
                  )}
                  <Pressable style={[styles.actionBtn, styles.deleteBtn]} onPress={() => handleDelete(row)} disabled={busyId === row.barcodeTargetId}>
                    {busyId === row.barcodeTargetId ? <ActivityIndicator size="small" color="#b91c1c" /> : <Text style={styles.deleteText}>Delete</Text>}
                  </Pressable>
                </View>
              </Pressable>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: A.bg },
  loader: { marginTop: spacing(4) },
  content: { padding: spacing(2) },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing(2), paddingBottom: 0 },
  countText: { color: A.muted, fontSize: 12 },
  addBtn: { height: 38, paddingHorizontal: 16, borderRadius: radius.sm, backgroundColor: A.primary, alignItems: 'center', justifyContent: 'center' },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  emptyText: { color: A.muted, fontSize: 13, textAlign: 'center', marginTop: spacing(4) },

  card: { backgroundColor: A.surface, borderRadius: radius.md, padding: 14, marginBottom: 12, ...shadow.card },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  name: { flex: 1, fontSize: 14, fontWeight: '800', color: A.ink },
  closedPill: { fontSize: 10, fontWeight: '700', color: '#6b7280', backgroundColor: '#f3f4f6', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  sub: { fontSize: 11, color: A.muted, marginBottom: 8 },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  statChip: { fontSize: 10.5, fontWeight: '700', color: A.ink, backgroundColor: A.surfaceRaised, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  conflictChip: { fontSize: 10.5, fontWeight: '700', color: '#b45309', backgroundColor: '#fef3c7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },

  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  actionBtn: { flexGrow: 1, height: 38, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  editBtn: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: A.border },
  editText: { color: A.ink, fontWeight: '700', fontSize: 12 },
  conflictBtn: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#f59e0b' },
  conflictText: { color: '#b45309', fontWeight: '700', fontSize: 11 },
  deleteBtn: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#fca5a5' },
  deleteText: { color: '#b91c1c', fontWeight: '700', fontSize: 12 },
});
