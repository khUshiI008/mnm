import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';
import Share from 'react-native-share';
import Card from '../../components/Card';
import Icon from '../../components/Icon';
import { colors, radius, spacing } from '../../theme';
import { getBalanceStockFilters, getBalanceStockReport, FilterOption, BrandOption, BalanceStockRow } from '../../api/partyBalanceStockApi';

const P = colors.party;

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Same quote/comma/newline escaping as BalanceStock.aspx.cs's CsvEscape.
function csvEscape(s: string) {
  const v = s ?? '';
  if (v.includes(',') || v.includes('"') || v.includes('\n')) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

/** Node port of Party/BalanceStock.aspx — a "collective" live stock view across every article/branch/session for the Party's Brand, fixed date range. */
export default function PartyBalanceStockScreen() {
  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState<FilterOption[]>([]);
  const [sessions, setSessions] = useState<FilterOption[]>([]);
  const [selectedBranchIds, setSelectedBranchIds] = useState<Set<string>>(new Set());
  const [selectedSessionIds, setSelectedSessionIds] = useState<Set<string>>(new Set());
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [scopeName, setScopeName] = useState('');
  const [asOf, setAsOf] = useState('');
  const [fromDt, setFromDt] = useState('');

  // Brand picker — masked (hideBrandName) the same way Sale Report's is:
  // once true, brandOptions never carries real Brand names (the server
  // withholds them entirely), extraDescOptions carries the Party's own
  // Extra Description label(s) to show read-only instead.
  const [brandOptions, setBrandOptions] = useState<BrandOption[]>([]);
  const [hideBrandName, setHideBrandName] = useState(false);
  const [extraDescOptions, setExtraDescOptions] = useState<string[]>([]);
  const [selectedBrandIds, setSelectedBrandIds] = useState<Set<number>>(new Set());

  const [rows, setRows] = useState<BalanceStockRow[]>([]);
  const [search, setSearch] = useState('');
  const [reportLoading, setReportLoading] = useState(false);

  const loadFilters = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getBalanceStockFilters();
      setBranches(res.data.branches);
      setSessions(res.data.sessions);
      setScopeName(res.data.scope.displayName);
      setFromDt(res.data.fixedFrom);
      setSelectedBranchIds(new Set(res.data.branches.map((b) => b.id)));
      setSelectedSessionIds(new Set(res.data.sessions.map((s) => s.id)));
      setBrandOptions(res.data.scope.brandOptions);
      setHideBrandName(res.data.scope.hideBrandName);
      setExtraDescOptions(res.data.scope.extraDescOptions || []);
      setSelectedBrandIds(new Set(res.data.scope.brandOptions.map((b) => b.id)));
    } catch {
      Alert.alert('Could not load filters');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFilters();
  }, [loadFilters]);

  const loadReport = useCallback(async () => {
    setReportLoading(true);
    try {
      const res = await getBalanceStockReport({
        branchIds: Array.from(selectedBranchIds),
        sessionIds: Array.from(selectedSessionIds),
        // Masked Parties never get to narrow by Brand (see Gap 1 doc
        // comment on the server) — omit the param entirely for them so an
        // empty selectedBrandIds (brandOptions is always [] when masked)
        // can never be mistaken for "unchecked everything".
        brandIds: hideBrandName ? undefined : Array.from(selectedBrandIds),
      });
      if (res.data.success === false) {
        Alert.alert(res.data.message || 'Could not load Balance Stock');
      }
      setRows(res.data.rows);
      setAsOf(res.data.asOf);
    } catch {
      Alert.alert('Could not load Balance Stock');
    } finally {
      setReportLoading(false);
    }
  }, [selectedBranchIds, selectedSessionIds, selectedBrandIds, hideBrandName]);

  useEffect(() => {
    if (!loading) loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, selectedBranchIds, selectedSessionIds, selectedBrandIds]);

  const toggleBranch = (id: string) =>
    setSelectedBranchIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const toggleSession = (id: string) =>
    setSelectedSessionIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const toggleBrand = (id: number) =>
    setSelectedBrandIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const filteredRows = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => [r.articleNo, r.color, r.size, r.barcode, r.category].some((v) => (v || '').toLowerCase().includes(s)));
  }, [rows, search]);

  const exportCsv = async () => {
    if (filteredRows.length === 0) {
      Alert.alert('No rows to export.');
      return;
    }
    // Same column set/order as BalanceStock.aspx.cs's btnExportCsv_Click,
    // plus First/Last Purchase (Gap 2's new fields).
    const headers = [
      'Branch', 'Item Name', 'Color', 'Type', 'Category', 'First Purchase', 'Last Purchase',
      'Size', 'Open', 'Purc', 'Stock In', 'Stock Out', 'PurcRet', 'Sale', 'SaleRet', 'NetSale', 'qBal', 'Sale %', 'Barcode',
    ];
    const lines = [headers.join(',')];
    for (const r of filteredRows) {
      lines.push(
        [
          r.branch,
          r.articleNo,
          r.color,
          r.category,
          r.dept,
          r.firstPurchase,
          r.lastPurchase,
          r.size,
          r.open,
          r.purc,
          r.stockIn,
          r.stockOut,
          r.purcRet,
          r.sale,
          r.saleRet,
          r.netSale,
          r.qBal,
          r.salePct != null ? `${r.salePct}%` : '',
          r.barcode,
        ]
          .map((v) => csvEscape(String(v ?? '')))
          .join(',')
      );
    }
    // BOM-prefixed UTF-8, same trick as BalanceStock.aspx.cs's own CSV
    // export, so Excel opens it without mangling non-ASCII text.
    const csv = '﻿' + lines.join('\r\n');
    const filename = `BalanceStock_${new Date().toISOString().slice(0, 10)}.csv`;
    try {
      const localPath = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/${filename}`;
      await ReactNativeBlobUtil.fs.writeFile(localPath, csv, 'utf8');
      await Share.open({ url: `file://${localPath}`, filename, type: 'text/csv', failOnCancel: false });
    } catch {
      Alert.alert('Could not export CSV');
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={P.primary} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {!!scopeName && (
        <View style={styles.headerRow}>
          <Text style={styles.scopeText}>{scopeName}</Text>
          {!!asOf && (
            <Text style={styles.asOfText}>
              {formatDate(fromDt)} – {formatDate(asOf)}
            </Text>
          )}
        </View>
      )}

      {hideBrandName && extraDescOptions.length > 0 && (
        <View style={styles.extraDescRow}>
          {extraDescOptions.map((d) => (
            <View key={d} style={styles.extraDescChip}>
              <Text style={styles.extraDescChipText}>{d}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.searchRow}>
        <Icon name="search" size={16} color={P.muted} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search article, color, size, barcode..."
          placeholderTextColor={P.muted}
          autoCapitalize="none"
        />
      </View>

      <Pressable style={styles.filtersToggle} onPress={() => setFiltersOpen((v) => !v)}>
        <Text style={styles.filtersToggleText}>Filters (branches, sessions{!hideBrandName && brandOptions.length > 0 ? ', brands' : ''})</Text>
        <Icon name={filtersOpen ? 'chevronDown' : 'chevronRight'} size={16} color={P.muted} />
      </Pressable>

      {filtersOpen && (
        <Card style={styles.filterCard}>
          {branches.length > 0 && (
            <>
              <Text style={styles.filterLabel}>BRANCHES</Text>
              <View style={styles.chipWrap}>
                {branches.map((b) => {
                  const active = selectedBranchIds.has(b.id);
                  return (
                    <Pressable key={b.id} style={[styles.chip, active && styles.chipActive]} onPress={() => toggleBranch(b.id)}>
                      <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
                        {b.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}
          {sessions.length > 0 && (
            <>
              <Text style={[styles.filterLabel, { marginTop: spacing(1.5) }]}>SESSIONS</Text>
              <View style={styles.chipWrap}>
                {sessions.map((s) => {
                  const active = selectedSessionIds.has(s.id);
                  return (
                    <Pressable key={s.id} style={[styles.chip, active && styles.chipActive]} onPress={() => toggleSession(s.id)}>
                      <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
                        {s.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}
          {!hideBrandName && brandOptions.length > 0 && (
            <>
              <Text style={[styles.filterLabel, { marginTop: spacing(1.5) }]}>BRANDS</Text>
              <View style={styles.chipWrap}>
                {brandOptions.map((b) => {
                  const active = selectedBrandIds.has(b.id);
                  return (
                    <Pressable key={b.id} style={[styles.chip, active && styles.chipActive]} onPress={() => toggleBrand(b.id)}>
                      <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
                        {b.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}
        </Card>
      )}

      {reportLoading ? (
        <ActivityIndicator size="large" color={P.primary} style={styles.loader} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.countRow}>
            <Text style={styles.countText}>{filteredRows.length} row(s)</Text>
            <Pressable style={styles.exportBtn} onPress={exportCsv}>
              <Icon name="share" size={13} color={P.primary} />
              <Text style={styles.exportBtnText}>Export CSV</Text>
            </Pressable>
          </View>
          {filteredRows.length === 0 ? (
            <Text style={styles.emptyText}>No stock rows found.</Text>
          ) : (
            filteredRows.map((r, i) => (
              <Card key={i} style={styles.row}>
                <View style={styles.rowHeader}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {r.articleNo} {r.color ? `· ${r.color}` : ''} {r.size ? `· ${r.size}` : ''}
                  </Text>
                  <Text style={styles.balValue}>{r.qBal}</Text>
                </View>
                <Text style={styles.rowSub}>
                  {r.branch} · {[r.category, r.dept].filter(Boolean).join(' / ')}
                </Text>
                {(!!r.firstPurchase || !!r.lastPurchase) && (
                  <Text style={styles.purchaseDates}>
                    {r.firstPurchase && r.lastPurchase ? `${r.firstPurchase} – ${r.lastPurchase}` : r.firstPurchase || r.lastPurchase}
                  </Text>
                )}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginTop: 6 }}>
                  <StatChip label="Open" value={r.open} />
                  <StatChip label="Purc" value={r.purc} />
                  <StatChip label="In" value={r.stockIn} />
                  <StatChip label="Out" value={r.stockOut} />
                  <StatChip label="Sale" value={r.sale} />
                  <StatChip label="SaleRet" value={r.saleRet} />
                  {r.salePct != null && <StatChip label="Sale%" value={`${r.salePct}%`} />}
                  {!!r.barcode && <StatChip label="Barcode" value={r.barcode} />}
                </ScrollView>
              </Card>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statChip}>
      <Text style={styles.statChipValue}>{value}</Text>
      <Text style={styles.statChipLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: P.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: P.bg },
  loader: { marginTop: spacing(4) },
  content: { padding: spacing(2) },

  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing(2), paddingTop: spacing(1.5) },
  scopeText: { fontSize: 12, color: P.ink, fontWeight: '700' },
  asOfText: { fontSize: 10.5, color: P.muted },

  extraDescRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: spacing(2), marginTop: 8 },
  extraDescChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: P.surfaceRaised, borderWidth: 1, borderColor: P.border },
  extraDescChipText: { fontSize: 11, fontWeight: '700', color: P.ink },

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: P.surface,
    borderWidth: 1,
    borderColor: P.border,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    marginHorizontal: spacing(2),
    marginTop: 8,
  },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 13, color: P.ink },

  filtersToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, paddingHorizontal: spacing(2) },
  filtersToggleText: { fontSize: 12, fontWeight: '700', color: P.muted },
  filterCard: { marginHorizontal: spacing(2), marginBottom: spacing(1) },
  filterLabel: { fontSize: 10.5, fontWeight: '800', color: P.muted, letterSpacing: 0.5, marginBottom: 6 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: P.surfaceRaised, borderWidth: 1, borderColor: P.border, maxWidth: 200 },
  chipActive: { backgroundColor: P.primary, borderColor: P.primary },
  chipText: { fontSize: 11.5, fontWeight: '700', color: P.muted },
  chipTextActive: { color: '#fff' },

  countRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing(1.5) },
  countText: { color: P.muted, fontSize: 12 },
  exportBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.sm - 2, borderWidth: 1.5, borderColor: P.primary },
  exportBtnText: { color: P.primary, fontWeight: '700', fontSize: 11 },
  emptyText: { color: P.muted, fontSize: 13, textAlign: 'center', marginTop: spacing(4) },

  row: { marginBottom: spacing(1.5) },
  rowHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowTitle: { flex: 1, fontSize: 13, fontWeight: '800', color: P.ink },
  balValue: { fontSize: 15, fontWeight: '800', color: P.primary },
  rowSub: { fontSize: 11, color: P.muted, marginTop: 2 },
  purchaseDates: { fontSize: 10.5, color: P.muted, marginTop: 2 },

  statChip: { backgroundColor: P.surfaceRaised, borderRadius: radius.sm - 2, paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center', minWidth: 52 },
  statChipValue: { fontSize: 12, fontWeight: '800', color: P.ink },
  statChipLabel: { fontSize: 8.5, color: P.muted, marginTop: 1 },
});
