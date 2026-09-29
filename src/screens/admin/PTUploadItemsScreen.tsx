import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Button from '../../components/Button';
import TextField from '../../components/TextField';
import { colors, radius, shadow, spacing } from '../../theme';
import { deletePTItem, listPTItems, updatePTItem, PTHeaderTotals, PTItemRow } from '../../api/adminPTUploadApi';

const A = colors.admin;
const PAGE_SIZE = 50;

type Params = {
  ptUploadId: number;
  ptNo: string;
  orderNo: string;
  brandName: string;
  totalItems?: number;
  totalQuantity?: number;
  totalAmount?: number;
  excessCount?: number;
  unwantedCount?: number;
  hasDiscrepancy?: boolean;
};

/** Mirrors the "View / Edit Items" modal on Panel/PTUpload/Index.aspx — ArticleNo/Color/
 * Size are read-only here (they're the reconciliation key); only Quantity/prices/
 * description can be corrected. Editing Quantity re-derives the Excess flag against the
 * row's already-recorded OrderedQuantity — Unwanted (an identity mismatch) never changes
 * from a quantity edit. */
export default function PTUploadItemsScreen({ params }: { params: Params }) {
  const [items, setItems] = useState<PTItemRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [editTarget, setEditTarget] = useState<PTItemRow | null>(null);
  const [headerTotals, setHeaderTotals] = useState<PTHeaderTotals>({
    totalItems: params.totalItems || 0,
    totalQuantity: params.totalQuantity || 0,
    totalAmount: params.totalAmount || 0,
    excessCount: params.excessCount || 0,
    unwantedCount: params.unwantedCount || 0,
    hasDiscrepancy: !!params.hasDiscrepancy,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listPTItems(params.ptUploadId, { page: 1, pageSize: PAGE_SIZE });
      setItems(res.data.items);
      setTotalCount(res.data.totalCount);
      setPage(1);
    } catch {
      Alert.alert('Could not load items');
    } finally {
      setLoading(false);
    }
  }, [params.ptUploadId]);

  useEffect(() => {
    load();
  }, [load]);

  const loadMore = async () => {
    if (loadingMore || items.length >= totalCount) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const res = await listPTItems(params.ptUploadId, { page: nextPage, pageSize: PAGE_SIZE });
      setItems((prev) => [...prev, ...res.data.items]);
      setPage(nextPage);
    } catch {
      Alert.alert('Could not load more items');
    } finally {
      setLoadingMore(false);
    }
  };

  const handleDelete = (row: PTItemRow) => {
    Alert.alert('Remove this item?', `Row #${row.rowNo} (${row.articleNo || row.description || 'item'}) will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setBusyId(row.id);
          try {
            const res = await deletePTItem(row.id);
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
        <Text style={styles.headerTitle}>{params.ptNo}</Text>
        <Text style={styles.headerSub}>
          {params.orderNo} · {params.brandName}
        </Text>
        <Text style={styles.headerTotals}>
          {headerTotals.totalItems} item(s) · Qty {headerTotals.totalQuantity.toFixed(2)} · ₹{headerTotals.totalAmount.toFixed(2)}
        </Text>
        {headerTotals.hasDiscrepancy && (
          <View style={styles.badgeRow}>
            {headerTotals.excessCount > 0 && (
              <View style={[styles.issueBadge, styles.excessBadge]}>
                <Text style={styles.excessBadgeText}>{headerTotals.excessCount} Excess</Text>
              </View>
            )}
            {headerTotals.unwantedCount > 0 && (
              <View style={[styles.issueBadge, styles.unwantedBadge]}>
                <Text style={styles.unwantedBadgeText}>{headerTotals.unwantedCount} Unwanted</Text>
              </View>
            )}
          </View>
        )}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={A.primary} style={styles.loader} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {items.length === 0 ? (
            <Text style={styles.emptyText}>No items in this PT file.</Text>
          ) : (
            items.map((row) => (
              <View key={row.id} style={[styles.card, row.issueType && styles.cardIssue]}>
                <View style={styles.cardHeadRow}>
                  <Text style={styles.name}>
                    #{row.rowNo} · {row.articleNo || '—'}
                  </Text>
                  {row.issueType && (
                    <View style={[styles.issuePill, row.issueType === 'Excess' ? styles.excessPill : styles.unwantedPill]}>
                      <Text style={styles.issuePillText}>{row.issueType}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.sub}>{row.description || '—'}</Text>
                <Text style={styles.detailLine}>
                  {row.color || '—'} / {row.size || '—'} · Qty {row.quantity}
                  {row.orderedQuantity != null ? ` (ordered ${row.orderedQuantity})` : ''} · PurPrice ₹{row.purPrice ?? 0}
                </Text>
                <Text style={styles.detailLine}>Amount ₹{row.amount.toFixed(2)}</Text>
                {row.issueNote ? <Text style={styles.issueNote}>{row.issueNote}</Text> : null}

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
  row: PTItemRow;
  onClose: () => void;
  onSaved: (updated: PTItemRow, headerTotals: PTHeaderTotals) => void;
}) {
  const [quantity, setQuantity] = useState(String(row.quantity));
  const [purPrice, setPurPrice] = useState(row.purPrice != null ? String(row.purPrice) : '');
  const [itemMrp, setItemMrp] = useState(row.itemMrp != null ? String(row.itemMrp) : '');
  const [itemWsp, setItemWsp] = useState(row.itemWsp != null ? String(row.itemWsp) : '');
  const [description, setDescription] = useState(row.description || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const qty = parseFloat(quantity);
    if (!qty || qty <= 0) {
      Alert.alert('Invalid Quantity', 'Quantity must be a number greater than 0.');
      return;
    }
    setSaving(true);
    try {
      const res = await updatePTItem(row.id, {
        quantity: qty,
        purPrice: parseFloat(purPrice) || 0,
        itemMrp: parseFloat(itemMrp) || 0,
        itemWsp: parseFloat(itemWsp) || 0,
        description,
      });
      onSaved(
        {
          ...row,
          quantity: qty,
          purPrice: parseFloat(purPrice) || 0,
          itemMrp: parseFloat(itemMrp) || 0,
          itemWsp: parseFloat(itemWsp) || 0,
          description,
          amount: res.data.amount,
          issueType: res.data.issueType as PTItemRow['issueType'],
          issueNote: res.data.issueNote,
        },
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
            <Text style={styles.modalIdentity}>
              {row.articleNo || '—'} · {row.color || '—'} / {row.size || '—'} (read-only)
            </Text>
            <TextField label="Description" value={description} onChangeText={setDescription} />
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

  badgeRow: { flexDirection: 'row', gap: 6, marginTop: 8 },
  issueBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  excessBadge: { backgroundColor: '#fef3c7' },
  excessBadgeText: { fontSize: 10, fontWeight: '700', color: '#b45309' },
  unwantedBadge: { backgroundColor: '#fee2e2' },
  unwantedBadgeText: { fontSize: 10, fontWeight: '700', color: '#b91c1c' },

  emptyText: { color: A.muted, fontSize: 13, textAlign: 'center', marginTop: spacing(4) },

  card: { backgroundColor: A.surface, borderRadius: radius.md, padding: 14, marginBottom: 12, ...shadow.card },
  cardIssue: { borderWidth: 1, borderColor: '#fde68a' },
  cardHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  name: { fontSize: 14, fontWeight: '800', color: A.ink },
  sub: { fontSize: 12, color: A.muted, marginTop: 2 },
  detailLine: { fontSize: 12, color: A.muted, marginTop: 2 },
  issueNote: { fontSize: 11, color: '#b45309', marginTop: 4 },
  issuePill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  excessPill: { backgroundColor: '#fef3c7' },
  unwantedPill: { backgroundColor: '#fee2e2' },
  issuePillText: { fontSize: 9, fontWeight: '800', color: A.ink },

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
  modalTitle: { fontSize: 15, fontWeight: '800', color: A.ink, marginBottom: 4 },
  modalIdentity: { fontSize: 11, color: A.muted, marginBottom: 12 },
  row2: { flexDirection: 'row', gap: 10 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
});
