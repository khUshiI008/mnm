import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, shadow, spacing } from '../../theme';
import {
  getSalesMasterData,
  SalesMasterDataEntity,
  SalesMasterDataItem,
  syncAllSalesMasterData,
  syncSalesMasterData,
} from '../../api/adminSalesMasterDataApi';

const A = colors.admin;

const TABS: { key: SalesMasterDataEntity; label: string }[] = [
  { key: 'categories', label: 'Categories' },
  { key: 'sessions', label: 'Sessions' },
  { key: 'departments', label: 'Departments' },
  { key: 'branches', label: 'Branches' },
  { key: 'suppliers', label: 'Suppliers' },
  { key: 'brands', label: 'Brands' },
  { key: 'salespersons', label: 'Salespersons' },
];

function fmtSyncedOn(v: string | null) {
  if (!v) return 'never';
  const diffMin = Math.round((Date.now() - new Date(v).getTime()) / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffMin < 1440) return `${Math.round(diffMin / 60)}h ago`;
  return new Date(v).toLocaleDateString();
}

/** Mirrors Panel/Sales/MasterData + Panel/Sales/Categories — 7 read-only caches synced from ZOrder, one tab per entity. */
export default function SalesMasterDataScreen() {
  const [tab, setTab] = useState<SalesMasterDataEntity>('categories');
  const [items, setItems] = useState<SalesMasterDataItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);
  const [search, setSearch] = useState('');

  const load = useCallback(async (entity: SalesMasterDataEntity, term?: string) => {
    setLoading(true);
    try {
      const res = await getSalesMasterData(entity, term);
      setItems(res.data.items);
    } catch {
      Alert.alert('Could not load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setSearch('');
    load(tab);
  }, [tab, load]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await syncSalesMasterData(tab);
      if (res.data.success) {
        Alert.alert('Sync complete', res.data.message || `${res.data.totalFromApi} from API: ${res.data.added} added, ${res.data.updated} updated.`);
        load(tab, search || undefined);
      } else {
        Alert.alert('Sync failed', res.data.message || 'Please try again.');
      }
    } catch (err: any) {
      Alert.alert('Sync failed', err?.response?.data?.message || 'Please try again.');
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncAll = async () => {
    setSyncingAll(true);
    try {
      const res = await syncAllSalesMasterData();
      const lines = Object.entries(res.data.results).map(
        ([key, r]) => `${key}: ${r.success ? `${r.added ?? 0} added, ${r.updated ?? 0} updated` : `failed — ${r.message || 'error'}`}`
      );
      Alert.alert(res.data.success ? 'Sync All complete' : 'Sync All finished with errors', lines.join('\n'));
      load(tab, search || undefined);
    } catch (err: any) {
      Alert.alert('Sync All failed', err?.response?.data?.message || 'Please try again.');
    } finally {
      setSyncingAll(false);
    }
  };

  return (
    <View style={styles.screen}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar} contentContainerStyle={styles.tabBarContent}>
        {TABS.map((t) => (
          <Pressable key={t.key} style={[styles.tab, tab === t.key && styles.tabActive]} onPress={() => setTab(t.key)}>
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]} numberOfLines={1}>
              {t.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.actionRow}>
        <View style={styles.searchBox}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search..."
            placeholderTextColor={A.muted}
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={() => load(tab, search || undefined)}
            returnKeyType="search"
          />
        </View>
        <Pressable style={styles.syncBtn} onPress={handleSync} disabled={syncing || syncingAll}>
          {syncing ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.syncBtnText}>Sync</Text>}
        </Pressable>
      </View>

      <Pressable style={styles.syncAllBtn} onPress={handleSyncAll} disabled={syncing || syncingAll}>
        {syncingAll ? <ActivityIndicator size="small" color={A.primary} /> : <Text style={styles.syncAllBtnText}>Sync All Entities</Text>}
      </Pressable>

      {loading ? (
        <ActivityIndicator size="large" color={A.primary} style={{ marginTop: spacing(4) }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={<Text style={styles.countText}>{items.length} records</Text>}
          ListEmptyComponent={<Text style={styles.emptyText}>No records yet — tap Sync to pull from ZOrder.</Text>}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowName}>{item.displayName || item.name}</Text>
                <Text style={styles.rowMeta}>
                  {[item.departmentName, item.city, item.hsnCode ? `HSN ${item.hsnCode}` : null].filter(Boolean).join(' · ') || item.id}
                </Text>
              </View>
              <View style={styles.rowRight}>
                {!item.activeStatus && (
                  <View style={styles.inactivePill}>
                    <Text style={styles.inactivePillText}>Inactive</Text>
                  </View>
                )}
                <Text style={styles.syncedText}>{fmtSyncedOn(item.lastSyncedOn)}</Text>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: A.bg },
  tabBar: { flexGrow: 0, flexShrink: 0, height: 52, backgroundColor: A.surface, borderBottomWidth: 1, borderBottomColor: A.border },
  tabBarContent: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing(2), paddingVertical: 8 },
  tab: {
    flexShrink: 0,
    minHeight: 34,
    paddingHorizontal: 14,
    marginRight: 8,
    borderRadius: 999,
    backgroundColor: A.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: { backgroundColor: A.primary },
  tabText: { fontSize: 12, fontWeight: '700', color: A.muted, includeFontPadding: false, textAlignVertical: 'center' },
  tabTextActive: { color: '#fff' },

  actionRow: { flexDirection: 'row', gap: 8, padding: spacing(2), paddingBottom: 0 },
  searchBox: { flex: 1, height: 40, borderWidth: 1, borderColor: A.border, borderRadius: radius.sm, backgroundColor: A.surface, justifyContent: 'center', paddingHorizontal: 12 },
  searchInput: { fontSize: 13, color: A.ink },
  syncBtn: { height: 40, paddingHorizontal: 16, borderRadius: radius.sm, backgroundColor: A.primary, alignItems: 'center', justifyContent: 'center' },
  syncBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },

  syncAllBtn: {
    marginHorizontal: spacing(2),
    marginTop: 8,
    height: 36,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: A.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncAllBtnText: { color: A.primary, fontWeight: '700', fontSize: 12 },

  listContent: { padding: spacing(2) },
  countText: { color: A.muted, fontSize: 12, marginBottom: spacing(1) },
  emptyText: { color: A.muted, fontSize: 13, textAlign: 'center', marginTop: spacing(4) },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: A.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: A.border,
    ...shadow.card,
  },
  rowName: { fontSize: 13, fontWeight: '700', color: A.ink },
  rowMeta: { fontSize: 11, color: A.muted, marginTop: 2 },
  rowRight: { alignItems: 'flex-end', gap: 4 },
  inactivePill: { backgroundColor: '#fee2e2', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
  inactivePillText: { fontSize: 9, fontWeight: '800', color: '#b91c1c' },
  syncedText: { fontSize: 10, color: A.muted },
});
