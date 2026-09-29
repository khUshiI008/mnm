import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Button from '../../components/Button';
import TextField from '../../components/TextField';
import { colors, radius, shadow, spacing } from '../../theme';
import { deleteOrderItem, listOrderItems, updateOrderItem, OrderHeaderTotals, OrderItemRow } from '../../api/adminOrderApi';

const A = colors.admin;
const PAGE_SIZE = 50;

type Params = {
  orderUploadId: number;
  orderNo: string;
  brandName: string;
  totalItems?: number;
  totalQuantity?: number;
  totalAmount?: number;
};

/** Mirrors the "View / Edit Items" modal on Panel/Orders/Index.aspx — paginated item grid
 * for one order, inline edit (recomputes Amount + the header's totals), delete row. */
export default function OrderItemsScreen({ params }: { params: Params }) {
  const [items, setItems] = useState<OrderItemRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [editTarget, setEditTarget] = useState<OrderItemRow | null>(null);
  const [headerTotals, setHeaderTotals] = useState<OrderHeaderTotals>({
    totalItems: params.totalItems || 0,
    totalQuantity: params.totalQuantity || 0,
    totalAmount: params.totalAmount || 0,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listOrderItems(params.orderUploadId, { page: 1, pageSize: PAGE_SIZE });
      setItems(res.data.items);
      setTotalCount(res.data.totalCount);
      setPage(1);
    } catch {
      Alert.alert('Could not load items');
    } finally {
      setLoading(false);
    }
  }, [params.orderUploadId]);

  useEffect(() => {
    load();
  }, [load]);

  const loadMore = async () => {
    if (loadingMore || items.length >= totalCount) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const res = await listOrderItems(params.orderUploadId, { page: nextPage, pageSize: PAGE_SIZE });
      setItems((prev) => [...prev, ...res.data.items]);
      setPage(nextPage);
    } catch {
      Alert.alert('Could not load more items');
    } finally {
      setLoadingMore(false);
    }
  };

  const handleDelete = (row: OrderItemRow) => {
    Alert.alert('Remove this item?', `Row #${row.rowNo} (${row.articleNo || row.description || 'item'}) will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setBusyId(row.id);
          try {
            const res = await deleteOrderItem(row.id);
            setItems((prev) => prev.filter((i) => i.id !== row.id));
            setTotalCount((c) => c - 1);
            if (res.data.headerTotals) setHeaderTotals(res.data.headerTotals);
          } catch (err: any) {
            Alert.alert('Could not remove', err?.response?.data?.message || 'Please try again.');
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.screen}>
      <View style={styles.headerCard}>
        <Text style={styles.headerTitle}>{params.orderNo}</Text>
        <Text style={styles.headerSub}>{params.brandName}</Text>
        <Text style={styles.headerTotals}>
          {headerTotals.totalItems} item(s) · Qty {headerTotals.totalQuantity.toFixed(2)} · ₹{headerTotals.totalAmount.toFixed(2)}
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={A.primary} style={styles.loader} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {items.length === 0 ? (
            <Text style={styles.emptyText}>No items in this order.</Text>
          ) : (
            items.map((row) => (
              <View key={row.id} style={styles.card}>
                <Text style={styles.name}>
                  #{row.rowNo} · {row.articleNo || '—'}
                </Text>
                <Text style={styles.sub}>{row.description || '—'}</Text>
                <Text style={styles.detailLine}>
                  {row.color || '—'} / {row.size || '—'} · Qty {row.quantity} · PurPrice ₹{row.purPrice ?? 0}
                </Text>
                <Text style={styles.detailLine}>Amount ₹{row.amount.toFixed(2)}</Text>

                <View style={styles.actionsRow}>
                  <Pressable style={[styles.actionBtn, styles.editBtn]} onPress={() => setEditTarget(row)}>
                    <Text style={styles.editText}>Edit</Text>
                  </Pressable>
                  <Pressable style={[styles.actionBtn, styles.deleteBtn]} onPress={() => handleDelete(row)} disabled={busyId === row.id}>
                    {busyId === row.id ? <ActivityIndicator size="small" color="#b91c1c" /> : <Text style={styles.deleteText}>Remove</Text>}
                  </Pressable>
                </View>
              </View>
            ))
          )}

          {items.length > 0 && items.length < totalCount && (
            <Pressable style={styles.loadMoreBtn} onPress={loadMore} disabled={loadingMore}>
              {loadingMore ? <ActivityIndicator size="small" color={A.primary} /> : <Text style={styles.loadMoreText}>Load more</Text>}
            </Pressable>
          )}
        </ScrollView>
      )}

      {editTarget && (
        <EditItemModal
          row={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={(updated, headerTotalsRes) => {
            setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
            setHeaderTotals(headerTotalsRes);
            setEditTarget(null);
          }}
        />
      )}
    </View>
  );
}

function EditItemModal({
  row,
  onClose,
  onSaved,
}: {
  row: OrderItemRow;
  onClose: () => void;
  onSaved: (updated: OrderItemRow, headerTotals: OrderHeaderTotals) => void;
}) {
  const [quantity, setQuantity] = useState(String(row.quantity));
  const [purPrice, setPurPrice] = useState(row.purPrice != null ? String(row.purPrice) : '');
  const [itemMrp, setItemMrp] = useState(row.itemMrp != null ? String(row.itemMrp) : '');
  const [itemWsp, setItemWsp] = useState(row.itemWsp != null ? String(row.itemWsp) : '');
  const [description, setDescription] = useState(row.description || '');
  const [color, setColor] = useState(row.color || '');
  const [size, setSize] = useState(row.size || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const qty = parseFloat(quantity);
    if (!qty || qty <= 0) {
      Alert.alert('Invalid Quantity', 'Quantity must be a number greater than 0.');
      return;
    }
    setSaving(true);
    try {
      const res = await updateOrderItem(row.id, {
        quantity: qty,
        purPrice: parseFloat(purPrice) || 0,
        itemMrp: parseFloat(itemMrp) || 0,
        itemWsp: parseFloat(itemWsp) || 0,
        description,
        color,
        size,
      });
      onSaved(
        { ...row, quantity: qty, purPrice: parseFloat(purPrice) || 0, itemMrp: parseFloat(itemMrp) || 0, itemWsp: parseFloat(itemWsp) || 0, description, color, size, amount: res.data.amount },
        res.data.headerTotals
      );
    } catch (err: any) {
      Alert.alert('Could not save', err?.response?.data?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <ScrollView contentContainerStyle={styles.modalScroll}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit Item #{row.rowNo}</Text>
            <TextField label="Description" value={description} onChangeText={setDescription} />
            <View style={styles.row2}>
              <TextField label="Color" value={color} onChangeText={setColor} style={{ flex: 1 }} />
              <TextField label="Size" value={size} onChangeText={setSize} style={{ flex: 1 }} />
            </View>
            <TextField label="Quantity" value={quantity} onChangeText={setQuantity} keyboardType="decimal-pad" />
            <View style={styles.row2}>
              <TextField label="Pur Price" value={purPrice} onChangeText={setPurPrice} keyboardType="decimal-pad" style={{ flex: 1 }} />
              <TextField label="MRP" value={itemMrp} onChangeText={setItemMrp} keyboardType="decimal-pad" style={{ flex: 1 }} />
            </View>
            <TextField label="WSP" value={itemWsp} onChangeText={setItemWsp} keyboardType="decimal-pad" />

            <View style={styles.modalActions}>
              <Button title="Cancel" variant="outline" onPress={onClose} style={{ flex: 1 }} />
              <Button title={saving ? 'Saving…' : 'Save'} onPress={handleSave} loading={saving} style={{ flex: 1 }} />
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: A.bg },
  loader: { marginTop: spacing(4) },
  content: { padding: spacing(2) },

  headerCard: { backgroundColor: A.surface, padding: spacing(2), borderBottomWidth: 1, borderBottomColor: A.border },
  headerTitle: { fontSize: 16, fontWeight: '800', color: A.ink },
  headerSub: { fontSize: 12, color: A.muted, marginTop: 2 },
  headerTotals: { fontSize: 12, fontWeight: '700', color: A.primary, marginTop: 6 },

  emptyText: { color: A.muted, fontSize: 13, textAlign: 'center', marginTop: spacing(4) },

  card: { backgroundColor: A.surface, borderRadius: radius.md, padding: 14, marginBottom: 12, ...shadow.card },
  name: { fontSize: 14, fontWeight: '800', color: A.ink },
  sub: { fontSize: 12, color: A.muted, marginTop: 2 },
  detailLine: { fontSize: 12, color: A.muted, marginTop: 2 },

  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionBtn: { flexGrow: 1, height: 38, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  editBtn: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: A.border },
  editText: { color: A.ink, fontWeight: '700', fontSize: 12 },
  deleteBtn: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#fca5a5' },
  deleteText: { color: '#b91c1c', fontWeight: '700', fontSize: 12 },

  loadMoreBtn: { alignItems: 'center', justifyContent: 'center', paddingVertical: 12, marginBottom: spacing(2) },
  loadMoreText: { color: A.primary, fontWeight: '700', fontSize: 13 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center' },
  modalScroll: { padding: spacing(2), alignItems: 'center' },
  modalCard: { width: '100%', maxWidth: 420, backgroundColor: A.surface, borderRadius: radius.md, padding: 18 },
  modalTitle: { fontSize: 15, fontWeight: '800', color: A.ink, marginBottom: 12 },
  row2: { flexDirection: 'row', gap: 10 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
});
