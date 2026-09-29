import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, shadow, spacing } from '../../theme';
import { useAdminNav } from '../../navigation/AdminShell';
import { deleteTarget, getTargets, TargetGridItem } from '../../api/adminTargetGenerateApi';
import MultiSelectPickerModal, { MultiSelectOption } from '../../components/admin/MultiSelectPickerModal';

const A = colors.admin;

const TARGET_TYPE_OPTIONS: MultiSelectOption[] = [
  { id: 1, label: 'Value' },
  { id: 2, label: 'Qty' },
  { id: 3, label: 'Both' },
];
const TARGET_TYPE_BY_ID: Record<number, string> = { 1: 'Value', 2: 'Qty', 3: 'Both' };

function money(n: number) {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}
function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

type FilterKey = 'emp' | 'dept' | 'branch' | 'mgr' | 'brand' | 'type';

export default function TargetGenerateScreen() {
  const { navigate } = useAdminNav();
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<TargetGridItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [openFilter, setOpenFilter] = useState<FilterKey | null>(null);

  const [empIds, setEmpIds] = useState<Set<number>>(new Set());
  const [deptIds, setDeptIds] = useState<Set<number>>(new Set());
  const [branchIds, setBranchIds] = useState<Set<number>>(new Set());
  const [mgrIds, setMgrIds] = useState<Set<number>>(new Set());
  const [brandIds, setBrandIds] = useState<Set<number>>(new Set());
  const [typeIds, setTypeIds] = useState<Set<number>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getTargets();
      setRows(res.data.targets);
    } catch {
      Alert.alert('Could not load targets');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Filter option universes are built purely from what's actually assigned across the
  // current rows — same "no dead options" convention as the .NET filter bar.
  const empOptions = useMemo(() => uniqueOptions(rows.flatMap((r) => r.employees)), [rows]);
  const deptOptions = useMemo(() => uniqueOptions(rows.flatMap((r) => r.departments)), [rows]);
  const branchOptions = useMemo(() => uniqueOptions(rows.flatMap((r) => r.branches)), [rows]);
  const mgrOptions = useMemo(() => uniqueOptions(rows.flatMap((r) => r.managers)), [rows]);
  const brandOptions = useMemo(() => {
    const names = Array.from(new Set(rows.flatMap((r) => r.brandNames))).sort((a, b) => a.localeCompare(b));
    return names.map((name, i) => ({ id: i + 1, label: name }));
  }, [rows]);
  const brandNameById = useMemo(() => new Map(brandOptions.map((o) => [o.id, o.label])), [brandOptions]);

  const activeFilterCount = empIds.size + deptIds.size + branchIds.size + mgrIds.size + brandIds.size + typeIds.size;

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    const selectedBrandNames = new Set(Array.from(brandIds).map((id) => brandNameById.get(id)).filter(Boolean) as string[]);
    const selectedTypes = new Set(Array.from(typeIds).map((id) => TARGET_TYPE_BY_ID[id]));

    return rows.filter((r) => {
      if (s && !(r.targetName.toLowerCase().includes(s) || r.brandNames.some((b) => b.toLowerCase().includes(s)))) return false;
      if (empIds.size && !r.employees.some((e) => empIds.has(e.id))) return false;
      if (deptIds.size && !r.departments.some((d) => deptIds.has(d.id))) return false;
      if (branchIds.size && !r.branches.some((b) => branchIds.has(b.id))) return false;
      if (mgrIds.size && !r.managers.some((m) => mgrIds.has(m.id))) return false;
      if (selectedBrandNames.size && !r.brandNames.some((b) => selectedBrandNames.has(b))) return false;
      if (selectedTypes.size && !selectedTypes.has(r.targetType)) return false;
      return true;
    });
  }, [rows, search, empIds, deptIds, branchIds, mgrIds, brandIds, typeIds, brandNameById]);

  const clearFilters = () => {
    setEmpIds(new Set());
    setDeptIds(new Set());
    setBranchIds(new Set());
    setMgrIds(new Set());
    setBrandIds(new Set());
    setTypeIds(new Set());
  };

  const handleDelete = (row: TargetGridItem) => {
    Alert.alert('Delete this target?', `${row.targetName} will be archived and hidden from active lists.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setBusyId(row.salesTargetId);
          try {
            await deleteTarget(row.salesTargetId);
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
        <TextInput
          style={styles.searchInput}
          placeholder="Search target or brand..."
          placeholderTextColor={A.muted}
          value={search}
          onChangeText={setSearch}
        />
        <Pressable style={styles.addBtn} onPress={() => navigate('TargetGenerateForm', { title: 'Add Target' })}>
          <Text style={styles.addBtnText}>+ Add</Text>
        </Pressable>
      </View>

      <View style={styles.secondRow}>
        <Pressable style={styles.barcodeBtn} onPress={() => navigate('BarcodeTargetList', { title: 'Barcode Target' })}>
          <Text style={styles.barcodeBtnText}>Barcode Target</Text>
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={{ gap: 8, paddingRight: 16 }}>
        <FilterChip label="Employee" count={empIds.size} onPress={() => setOpenFilter('emp')} />
        <FilterChip label="Department" count={deptIds.size} onPress={() => setOpenFilter('dept')} />
        <FilterChip label="Branch" count={branchIds.size} onPress={() => setOpenFilter('branch')} />
        <FilterChip label="Manager" count={mgrIds.size} onPress={() => setOpenFilter('mgr')} />
        <FilterChip label="Brand" count={brandIds.size} onPress={() => setOpenFilter('brand')} />
        <FilterChip label="Target Type" count={typeIds.size} onPress={() => setOpenFilter('type')} />
        {activeFilterCount > 0 && (
          <Pressable style={styles.clearChip} onPress={clearFilters}>
            <Text style={styles.clearChipText}>Clear filters</Text>
          </Pressable>
        )}
      </ScrollView>

      {loading ? (
        <ActivityIndicator size="large" color={A.primary} style={styles.loader} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.countText}>{filtered.length} target(s)</Text>
          {filtered.length === 0 ? (
            <Text style={styles.emptyText}>No targets found. Tap Add to create the first one.</Text>
          ) : (
            filtered.map((row) => (
              <Pressable key={row.salesTargetId} style={styles.card} onPress={() => navigate('TargetGenerateForm', { salesTargetId: row.salesTargetId, title: 'Edit Target' })}>
                <View style={styles.cardHeader}>
                  <Text style={styles.name} numberOfLines={1}>
                    {row.targetName}
                  </Text>
                  {row.isClosed && <Text style={styles.closedPill}>Closed</Text>}
                  <Text style={styles.scopePill}>{row.salesScope}</Text>
                </View>
                <Text style={styles.brandLine} numberOfLines={1}>
                  {row.brandNames.length ? row.brandNames.join(', ') : 'All brands'}
                </Text>
                <Text style={styles.sub}>
                  From {formatDate(row.effectiveFrom)}
                  {row.effectiveTo ? ` to ${formatDate(row.effectiveTo)}` : ''} · Week starts {row.weekStartDay}
                  {row.managerTargetMode === 'Multiple' ? ' · Multiple managers' : ''}
                </Text>
                <View style={styles.statsRow}>
                  {row.weeklyTargetValue > 0 && <Text style={styles.statChip}>Value: {money(row.weeklyTargetValue)}/wk</Text>}
                  {row.weeklyTargetQty > 0 && <Text style={styles.statChip}>Qty: {row.weeklyTargetQty}/wk</Text>}
                  <Text style={styles.statChip}>{row.targetType}</Text>
                  <Text style={styles.statChip}>
                    {row.employeeCount} emp · {row.managerCount} mgr
                  </Text>
                  {row.departments.length > 0 && <Text style={styles.statChip}>{row.departments.length} dept</Text>}
                  {row.branches.length > 0 && <Text style={styles.statChip}>{row.branches.length} branch</Text>}
                </View>

                <View style={styles.actionsRow}>
                  <Pressable style={[styles.actionBtn, styles.editBtn]} onPress={() => navigate('TargetGenerateForm', { salesTargetId: row.salesTargetId, title: 'Edit Target' })}>
                    <Text style={styles.editText}>Edit</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.actionBtn, styles.duplicateBtn]}
                    onPress={() => navigate('TargetGenerateForm', { duplicateFromId: row.salesTargetId, title: 'New Target from this' })}
                  >
                    <Text style={styles.duplicateText}>New from this</Text>
                  </Pressable>
                  <Pressable style={[styles.actionBtn, styles.deleteBtn]} onPress={() => handleDelete(row)} disabled={busyId === row.salesTargetId}>
                    {busyId === row.salesTargetId ? <ActivityIndicator size="small" color="#b91c1c" /> : <Text style={styles.deleteText}>Delete</Text>}
                  </Pressable>
                </View>
              </Pressable>
            ))
          )}
        </ScrollView>
      )}

      <MultiSelectPickerModal visible={openFilter === 'emp'} title="Filter by Employee" options={empOptions} selectedIds={empIds} onChange={setEmpIds} onClose={() => setOpenFilter(null)} />
      <MultiSelectPickerModal visible={openFilter === 'dept'} title="Filter by Department" options={deptOptions} selectedIds={deptIds} onChange={setDeptIds} onClose={() => setOpenFilter(null)} />
      <MultiSelectPickerModal visible={openFilter === 'branch'} title="Filter by Branch" options={branchOptions} selectedIds={branchIds} onChange={setBranchIds} onClose={() => setOpenFilter(null)} />
      <MultiSelectPickerModal visible={openFilter === 'mgr'} title="Filter by Manager" options={mgrOptions} selectedIds={mgrIds} onChange={setMgrIds} onClose={() => setOpenFilter(null)} />
      <MultiSelectPickerModal visible={openFilter === 'brand'} title="Filter by Brand" options={brandOptions} selectedIds={brandIds} onChange={setBrandIds} onClose={() => setOpenFilter(null)} />
      <MultiSelectPickerModal visible={openFilter === 'type'} title="Filter by Target Type" options={TARGET_TYPE_OPTIONS} selectedIds={typeIds} onChange={setTypeIds} onClose={() => setOpenFilter(null)} />
    </View>
  );
}

function uniqueOptions(items: { id: number; name: string }[]): MultiSelectOption[] {
  const map = new Map<number, string>();
  for (const it of items) if (!map.has(it.id)) map.set(it.id, it.name);
  return Array.from(map.entries())
    .map(([id, label]) => ({ id, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function FilterChip({ label, count, onPress }: { label: string; count: number; onPress: () => void }) {
  const active = count > 0;
  return (
    <Pressable style={[styles.filterChip, active && styles.filterChipActive]} onPress={onPress}>
      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label}</Text>
      {active && (
        <View style={styles.filterChipBadge}>
          <Text style={styles.filterChipBadgeText}>{count}</Text>
        </View>
      )}
    </Pressable>
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
  secondRow: { paddingHorizontal: spacing(2), marginTop: 8 },
  barcodeBtn: { alignSelf: 'flex-start', height: 36, paddingHorizontal: 14, borderRadius: radius.sm, borderWidth: 1.5, borderColor: A.border, alignItems: 'center', justifyContent: 'center' },
  barcodeBtnText: { color: A.ink, fontWeight: '700', fontSize: 12 },

  filterRow: { marginTop: 10, paddingLeft: spacing(2), flexGrow: 0 },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 32, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: A.border, backgroundColor: A.surface },
  filterChipActive: { borderColor: A.primary, backgroundColor: A.primary + '12' },
  filterChipText: { fontSize: 11.5, fontWeight: '700', color: A.muted },
  filterChipTextActive: { color: A.primary },
  filterChipBadge: { minWidth: 16, height: 16, borderRadius: 8, backgroundColor: A.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  filterChipBadgeText: { color: '#fff', fontSize: 9.5, fontWeight: '800' },
  clearChip: { height: 32, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: '#fca5a5', backgroundColor: '#fef2f2', alignItems: 'center', justifyContent: 'center' },
  clearChipText: { color: '#dc2626', fontSize: 11.5, fontWeight: '700' },

  countText: { color: A.muted, fontSize: 12, marginBottom: spacing(1.5) },
  emptyText: { color: A.muted, fontSize: 13, textAlign: 'center', marginTop: spacing(4) },

  card: { backgroundColor: A.surface, borderRadius: radius.md, padding: 14, marginBottom: 12, ...shadow.card },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  name: { flex: 1, fontSize: 14, fontWeight: '800', color: A.ink },
  scopePill: { fontSize: 10, fontWeight: '700', color: A.primary, backgroundColor: A.primary + '15', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  closedPill: { fontSize: 10, fontWeight: '700', color: '#6b7280', backgroundColor: '#f3f4f6', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  brandLine: { fontSize: 12, color: A.ink, marginBottom: 2 },
  sub: { fontSize: 11, color: A.muted, marginBottom: 8 },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  statChip: { fontSize: 10.5, fontWeight: '700', color: A.ink, backgroundColor: A.surfaceRaised, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },

  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  actionBtn: { flexGrow: 1, height: 38, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  editBtn: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: A.border },
  editText: { color: A.ink, fontWeight: '700', fontSize: 12 },
  duplicateBtn: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: A.primary },
  duplicateText: { color: A.primary, fontWeight: '700', fontSize: 11 },
  deleteBtn: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#fca5a5' },
  deleteText: { color: '#b91c1c', fontWeight: '700', fontSize: 12 },
});
