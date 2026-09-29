import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../../theme';
import { getFastMovingProducts, FastMovingRow } from '../../api/partyFastMovingApi';

const P = colors.party;
const BUCKET_COLORS = { fastMoving: '#16a34a', alsoMoving: '#0d9488', slowMoving: '#f59e0b', nonMoving: '#ef4444' };

/**
 * Node port of the Dashboard's Fast Moving Products card
 * (FastMovingProductsSummary.ashx + FastMovingAgingCalculator) — a FIFO
 * purchase-to-sale aging breakdown per Article+Color, rolled up across
 * Size/Branch/Session. Deliberately ignores the Dashboard's period preset
 * and chart-click filters (always full history) — only the active Brand
 * selection carries over.
 */
export default function FastMovingWidget({ brandId, previewPartyId }: { brandId?: number; previewPartyId?: number }) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<FastMovingRow[]>([]);
  const [notConfigured, setNotConfigured] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await getFastMovingProducts({ brandId }, previewPartyId);
        setRows(res.data.rows);
        setNotConfigured(res.data.notConfigured);
      } catch {
        Alert.alert('Could not load Fast Moving Products');
      } finally {
        setLoading(false);
      }
    })();
  }, [brandId, previewPartyId]);

  if (loading) {
    return (
      <View style={styles.card}>
        <ActivityIndicator size="large" color={P.primary} />
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Fast Moving Products</Text>
      <View style={styles.legendRow}>
        <LegendDot color={BUCKET_COLORS.fastMoving} label="Fast (≤21d)" />
        <LegendDot color={BUCKET_COLORS.alsoMoving} label="Also (22-45d)" />
        <LegendDot color={BUCKET_COLORS.slowMoving} label="Slow (46-60d)" />
        <LegendDot color={BUCKET_COLORS.nonMoving} label="Non (60d+)" />
      </View>

      {notConfigured ? (
        <Text style={styles.emptyText}>No Sessions have been flagged "fast moving" yet — ask admin to configure this.</Text>
      ) : rows.length === 0 ? (
        <Text style={styles.emptyText}>No fast-moving data found.</Text>
      ) : (
        rows.map((r, i) => <RowCard key={i} row={r} />)
      )}
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

function RowCard({ row }: { row: FastMovingRow }) {
  const total = row.fastMoving + row.alsoMoving + row.slowMoving + row.nonMoving || 1;
  return (
    <View style={styles.row}>
      <View style={styles.rowHeader}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {row.articleNo} {row.color ? `· ${row.color}` : ''}
        </Text>
        <Text style={styles.rowBalance}>{row.liveBalanceQty}</Text>
      </View>
      <View style={styles.barWrap}>
        {(['fastMoving', 'alsoMoving', 'slowMoving', 'nonMoving'] as const).map((k) =>
          row[k] > 0 ? <View key={k} style={{ flex: row[k] / total, backgroundColor: BUCKET_COLORS[k], height: 8 }} /> : null
        )}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginTop: 6 }}>
        <StatChip label="Sold" value={row.totalSold} />
        <StatChip label="Received" value={row.receivedQty} />
        <StatChip label="Balance" value={row.liveBalanceQty} highlight />
        {row.unresolvedQty > 0 && <StatChip label="Unresolved" value={row.unresolvedQty} />}
      </ScrollView>
    </View>
  );
}

function StatChip({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <View style={[styles.statChip, highlight && styles.statChipHighlight]}>
      <Text style={[styles.statChipValue, highlight && styles.statChipValueHighlight]}>{value}</Text>
      <Text style={styles.statChipLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: P.surface, borderRadius: radius.md, padding: 14 },
  title: { fontSize: 13.5, fontWeight: '800', color: P.ink, marginBottom: 8 },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { fontSize: 9.5, color: P.muted, fontWeight: '600' },
  emptyText: { fontSize: 12, color: P.muted, textAlign: 'center', marginTop: spacing(2) },

  row: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: P.border },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  rowTitle: { flex: 1, fontSize: 12.5, fontWeight: '700', color: P.ink },
  rowBalance: { fontSize: 13, fontWeight: '800', color: P.primary },
  barWrap: { flexDirection: 'row', borderRadius: 4, overflow: 'hidden', backgroundColor: P.surfaceRaised },

  statChip: { backgroundColor: P.surfaceRaised, borderRadius: radius.sm - 2, paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center', minWidth: 52 },
  statChipHighlight: { backgroundColor: '#ccfbf1' },
  statChipValue: { fontSize: 12, fontWeight: '800', color: P.ink },
  statChipValueHighlight: { color: P.primaryDark },
  statChipLabel: { fontSize: 8.5, color: P.muted, marginTop: 1 },
});
