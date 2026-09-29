import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Picker } from '../../components/AppPicker';
import Button from '../../components/Button';
import DateField from '../../components/DateField';
import { colors, radius, shadow, spacing } from '../../theme';
import { useAdminNav } from '../../navigation/AdminShell';
import {
  deleteOrder,
  lookupOrderBrands,
  listOrders,
  updateOrderHeader,
  OrderBrandOption,
  OrderRow,
} from '../../api/adminOrderApi';

const A = colors.admin;
const PAGE_SIZE = 15;

const STATUS_COLOR: Record<string, { bg: string; fg: string }> = {
  Completed: { bg: '#dcfce7', fg: '#15803d' },
  Uploading: { bg: '#fef3c7', fg: '#b45309' },
  Failed: { bg: '#fee2e2', fg: '#b91c1c' },
};

export default function OrdersListScreen() {
  const { navigate } = useAdminNav();
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [editTarget, setEditTarget] = useState<OrderRow | null>(null);

  const load = useCallback(async (term?: string) => {
    setLoading(true);
    try {
      const res = await listOrders({ search: term, page: 1, pageSize: PAGE_SIZE });
      setRows(res.data.orders);
      setTotalCount(res.data.totalCount);
      setPage(1);
    } catch {
      Alert.alert('Could not load orders');
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
      const res = await listOrders({ search: search || undefined, page: nextPage, pageSize: PAGE_SIZE });
      setRows((prev) => [...prev, ...res.data.orders]);
      setPage(nextPage);
    } catch {
      Alert.alert('Could not load more orders');
    } finally {
      setLoadingMore(false);
    }
  };

  const handleDelete = (row: OrderRow) => {
    Alert.alert('Archive this order?', `${row.orderNo} will be archived. Its item history is kept.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Archive',
        style: 'destructive',
        onPress: async () => {
          setBusyId(row.id);
          try {
            await deleteOrder(row.id);
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
          placeholder="Search order no / brand / file..."
          placeholderTextColor={A.muted}
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={() => load(search || undefined)}
          returnKeyType="search"
        />
        <Pressable style={styles.addBtn} onPress={() => navigate('OrderUpload')}>
          <Text style={styles.addBtnText}>+ Upload</Text>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={A.primary} style={styles.loader} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.countText}>{totalCount} order(s)</Text>
          {rows.length === 0 ? (
            <Text style={styles.emptyText}>No orders found. Tap Upload to add the first one.</Text>
          ) : (
            rows.map((row) => {
              const statusColor = STATUS_COLOR[row.status] || STATUS_COLOR.Uploading;
              return (
                <Pressable
                  key={row.id}
                  style={styles.card}
                  onPress={() =>
                    navigate('OrderItems', {
                      orderUploadId: row.id,
                      orderNo: row.orderNo,
                      brandName: row.brandName,
                      totalItems: row.totalItems,
                      totalQuantity: row.totalQuantity,
                      totalAmount: row.totalAmount,
                    })
                  }
                >
                  <View style={styles.cardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>{row.orderNo}</Text>
                      <Text style={styles.sub}>
                        {formatDate(row.orderDate)} · {row.brandName}
                      </Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusColor.bg }]}>
                      <Text style={[styles.statusBadgeText, { color: statusColor.fg }]}>{row.status}</Text>
                    </View>
                  </View>

                  {row.hasPTDiscrepancy && (
                    <View style={styles.ptBadge}>
                      <Text style={styles.ptBadgeText}>PT discrepancy flagged</Text>
                    </View>
                  )}

                  <Text style={styles.detailLine}>{row.fileName || '—'}</Text>
                  <Text style={styles.detailLine}>
                    {row.totalItems} item(s) · Qty {row.totalQuantity.toFixed(2)} · ₹{row.totalAmount.toFixed(2)}
                  </Text>
                  {row.invoiceNo ? <Text style={styles.detailLine}>Invoice {row.invoiceNo}{row.invoiceDt ? ` · ${formatDate(row.invoiceDt)}` : ''}</Text> : null}

                  <View style={styles.actionsRow}>
                    <Pressable style={[styles.actionBtn, styles.editBtn]} onPress={() => setEditTarget(row)}>
                      <Text style={styles.editText}>Edit</Text>
                    </Pressable>
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

      {editTarget && (
        <EditOrderModal
          row={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => {
            setEditTarget(null);
            load(search || undefined);
          }}
        />
      )}
    </View>
  );
}

function formatDate(iso: string) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function EditOrderModal({ row, onClose, onSaved }: { row: OrderRow; onClose: () => void; onSaved: () => void }) {
  const [orderDate, setOrderDate] = useState(row.orderDate.slice(0, 10));
  const [brandId, setBrandId] = useState(row.brandId);
  const [brands, setBrands] = useState<OrderBrandOption[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    lookupOrderBrands()
      .then((res) => setBrands(res.data.brands))
      .catch(() => Alert.alert('Could not load brands'));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateOrderHeader(row.id, orderDate, brandId);
      onSaved();
    } catch (err: any) {
      Alert.alert('Could not save', err?.response?.data?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Edit {row.orderNo}</Text>
          <DateField label="Order Date" value={orderDate} onChange={setOrderDate} />
          <Text style={styles.label}>Brand</Text>
          <View style={styles.pickerWrap}>
            <Picker selectedValue={brandId} onValueChange={(v) => setBrandId(Number(v))}>
              {brands.map((b) => (
                <Picker.Item key={b.id} label={b.name} value={b.id} />
              ))}
            </Picker>
          </View>
          <View style={styles.modalActions}>
            <Button title="Cancel" variant="outline" onPress={onClose} style={{ flex: 1 }} />
            <Button title={saving ? 'Saving…' : 'Save'} onPress={handleSave} loading={saving} style={{ flex: 1 }} />
          </View>
        </View>
      </View>
    </Modal>
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
  ptBadge: { alignSelf: 'flex-start', backgroundColor: '#fee2e2', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, marginBottom: 6 },
  ptBadgeText: { fontSize: 10, fontWeight: '700', color: '#b91c1c' },
  detailLine: { fontSize: 12, color: A.muted, marginTop: 2 },

  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionBtn: { flexGrow: 1, height: 38, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  editBtn: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: A.border },
  editText: { color: A.ink, fontWeight: '700', fontSize: 12 },
  deleteBtn: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#fca5a5' },
  deleteText: { color: '#b91c1c', fontWeight: '700', fontSize: 12 },

  loadMoreBtn: { alignItems: 'center', justifyContent: 'center', paddingVertical: 12, marginBottom: spacing(2) },
  loadMoreText: { color: A.primary, fontWeight: '700', fontSize: 13 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: spacing(2) },
  modalCard: { width: '100%', maxWidth: 420, backgroundColor: A.surface, borderRadius: radius.md, padding: 18 },
  modalTitle: { fontSize: 15, fontWeight: '800', color: A.ink, marginBottom: 12 },
  label: { fontSize: 13, color: A.muted, marginBottom: 6, fontWeight: '500' },
  pickerWrap: { borderWidth: 1, borderColor: A.border, borderRadius: radius.sm, backgroundColor: A.surface, marginBottom: 16 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
});
