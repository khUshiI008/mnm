import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, shadow, spacing } from '../../theme';
import { useAdminNav } from '../../navigation/AdminShell';
import { deletePTUpload, listPTUploads, PTUploadRow } from '../../api/adminPTUploadApi';

const A = colors.admin;
const PAGE_SIZE = 15;

const STATUS_COLOR: Record<string, { bg: string; fg: string }> = {
  Completed: { bg: '#dcfce7', fg: '#15803d' },
  Uploading: { bg: '#fef3c7', fg: '#b45309' },
  Failed: { bg: '#fee2e2', fg: '#b91c1c' },
};

/** Mirrors Panel/PTUpload/Index.aspx — there is deliberately no "Edit" here: a PT
 * upload's Brand/Invoice/matched Order are the reconciliation context it was checked
 * against, so only individual item rows can be corrected (via PTUploadItemsScreen). */
export default function PTUploadListScreen() {
  const { navigate } = useAdminNav();
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<PTUploadRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async (term?: string) => {
    setLoading(true);
    try {
      const res = await listPTUploads({ search: term, page: 1, pageSize: PAGE_SIZE });
      setRows(res.data.uploads);
      setTotalCount(res.data.totalCount);
      setPage(1);
    } catch {
      Alert.alert('Could not load PT files');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const loadMore = async () => {
    if (loadingMore || rows.length >= totalCount) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const res = await listPTUploads({ search: search || undefined, page: nextPage, pageSize: PAGE_SIZE });
      setRows((prev) => [...prev, ...res.data.uploads]);
      setPage(nextPage);
    } catch {
      Alert.alert('Could not load more PT files');
    } finally {
      setLoadingMore(false);
    }
  };

  const handleDelete = (row: PTUploadRow) => {
    Alert.alert('Archive this PT file?', `${row.ptNo} will be archived. Its item history is kept.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Archive',
        style: 'destructive',
        onPress: async () => {
          setBusyId(row.id);
          try {
            await deletePTUpload(row.id);
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
          placeholder="Search PT no / order / brand..."
          placeholderTextColor={A.muted}
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={() => load(search || undefined)}
          returnKeyType="search"
        />
        <Pressable style={styles.addBtn} onPress={() => navigate('PTUploadWizard')}>
          <Text style={styles.addBtnText}>+ Upload</Text>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={A.primary} style={styles.loader} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.countText}>{totalCount} PT file(s)</Text>
          {rows.length === 0 ? (
            <Text style={styles.emptyText}>No PT files found. Tap Upload to add the first one.</Text>
          ) : (
            rows.map((row) => {
              const statusColor = STATUS_COLOR[row.status] || STATUS_COLOR.Uploading;
              return (
                <Pressable
                  key={row.id}
                  style={styles.card}
                  onPress={() =>
                    navigate('PTUploadItems', {
                      ptUploadId: row.id,
                      ptNo: row.ptNo,
                      orderNo: row.orderNo,
                      brandName: row.brandName,
                      totalItems: row.totalItems,
                      totalQuantity: row.totalQuantity,
                      totalAmount: row.totalAmount,
                      excessCount: row.excessCount,
                      unwantedCount: row.unwantedCount,
                      hasDiscrepancy: row.hasDiscrepancy,
                    })
                  }
                >
                  <View style={styles.cardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>{row.ptNo}</Text>
                      <Text style={styles.sub}>
                        {row.orderNo} · {row.brandName}
                      </Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusColor.bg }]}>
                      <Text style={[styles.statusBadgeText, { color: statusColor.fg }]}>{row.status}</Text>
                    </View>
                  </View>

                  {row.hasDiscrepancy && (
                    <View style={styles.badgeRow}>
                      {row.excessCount > 0 && (
                        <View style={[styles.issueBadge, styles.excessBadge]}>
                          <Text style={styles.excessBadgeText}>{row.excessCount} Excess</Text>
                        </View>
                      )}
                      {row.unwantedCount > 0 && (
                        <View style={[styles.issueBadge, styles.unwantedBadge]}>
                          <Text style={styles.unwantedBadgeText}>{row.unwantedCount} Unwanted</Text>
                        </View>
                      )}
                    </View>
                  )}

                  <Text style={styles.detailLine}>{row.fileName || '—'}</Text>
                  <Text style={styles.detailLine}>
                    {row.totalItems} item(s) · Qty {row.totalQuantity.toFixed(2)} · ₹{row.totalAmount.toFixed(2)}
                  </Text>
                  {row.invoiceNo ? <Text style={styles.detailLine}>Invoice {row.invoiceNo}</Text> : null}

                  <View style={styles.actionsRow}>
                    <Pressable style={[styles.actionBtn, styles.deleteBtn]} onPress={() => handleDelete(row)} disabled={busyId === row.id}>
                      {busyId === row.id ? <ActivityIndicator size="small" color="#b91c1c" /> : <Text style={styles.deleteText}>Archive</Text>}
                    </Pressable>
                  </View>
                </Pressable>
              );
            })
          )}

          {rows.length > 0 && rows.length < totalCount && (
            <Pressable style={styles.loadMoreBtn} onPress={loadMore} disabled={loadingMore}>
              {loadingMore ? <ActivityIndicator size="small" color={A.primary} /> : <Text style={styles.loadMoreText}>Load more</Text>}
            </Pressable>
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
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  statusBadgeText: { fontSize: 10, fontWeight: '700' },

  badgeRow: { flexDirection: 'row', gap: 6, marginBottom: 6 },
  issueBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  excessBadge: { backgroundColor: '#fef3c7' },
  excessBadgeText: { fontSize: 10, fontWeight: '700', color: '#b45309' },
  unwantedBadge: { backgroundColor: '#fee2e2' },
  unwantedBadgeText: { fontSize: 10, fontWeight: '700', color: '#b91c1c' },

  detailLine: { fontSize: 12, color: A.muted, marginTop: 2 },

  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionBtn: { flexGrow: 1, height: 38, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  deleteBtn: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#fca5a5' },
  deleteText: { color: '#b91c1c', fontWeight: '700', fontSize: 12 },

  loadMoreBtn: { alignItems: 'center', justifyContent: 'center', paddingVertical: 12, marginBottom: spacing(2) },
  loadMoreText: { color: A.primary, fontWeight: '700', fontSize: 13 },
});
