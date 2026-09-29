import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Icon from '../../components/Icon';
import Card from '../../components/Card';
import { colors, radius, spacing } from '../../theme';
import Sound from 'react-native-sound';
import { sendGoodJobRemark, getGoodJobStatus, getTargetAnalysis, PerformanceBucket, TargetAnalysisMode, TargetAnalysisRow } from '../../api/adminTargetAnalysisApi';
import MultiSelectPickerModal, { MultiSelectOption } from '../../components/admin/MultiSelectPickerModal';
import Button from '../../components/Button';

const A = colors.admin;

const BUCKET_LABEL: Record<PerformanceBucket, string> = { top: 'Top Achiever', well: 'Well Performing', avg: 'Average', under: 'Underperforming', critical: 'Critical' };
const BUCKET_COLOR: Record<PerformanceBucket, string> = { top: '#16a34a', well: '#2563eb', avg: '#d97706', under: '#f97316', critical: '#e11d48' };
const BUCKET_ORDER: PerformanceBucket[] = ['top', 'well', 'avg', 'under', 'critical'];

const TYPE_OPTS: MultiSelectOption[] = [
  { id: 1, label: 'Value-based' },
  { id: 2, label: 'Qty-based' },
  { id: 3, label: 'Both (Value + Qty)' },
];
const TYPE_BY_ID: Record<number, string> = { 1: 'Value', 2: 'Qty', 3: 'Both' };
const SCOPE_OPTS: MultiSelectOption[] = [
  { id: 1, label: 'Personal Sale' },
  { id: 2, label: 'Overall Brand Sale' },
];
const SCOPE_BY_ID: Record<number, string> = { 1: 'Personal', 2: 'Overall' };
const PTYPE_OPTS: MultiSelectOption[] = [
  { id: 1, label: 'Only Manager' },
  { id: 2, label: 'Only Staff' },
  { id: 3, label: 'Both (Employee + Manager)' },
  { id: 4, label: 'Only Attached Staff' },
];
const PTYPE_BY_ID: Record<number, string> = { 1: 'manager', 2: 'staff', 3: 'both', 4: 'attached' };
const PERF_OPTS: MultiSelectOption[] = [
  { id: 1, label: 'Top Achiever (>=110%)' },
  { id: 2, label: 'Well Performing (90-109%)' },
  { id: 3, label: 'Average (70-89%)' },
  { id: 4, label: 'Underperforming (40-69%)' },
  { id: 5, label: 'Critical (<40%)' },
];
const PERF_BY_ID: Record<number, PerformanceBucket> = { 1: 'top', 2: 'well', 3: 'avg', 4: 'under', 5: 'critical' };

type ViewMode = 'target' | 'employee' | 'group' | 'perf';
type SortMode = 'default' | 'perf-desc' | 'perf-asc';
type FilterKey = 'emp' | 'mgr' | 'dept' | 'branch' | 'brand' | 'target' | 'type' | 'scope' | 'ptype' | 'perf';

function money(n: number) {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}
function uniqueOpts(items: { id: number; label: string }[]): MultiSelectOption[] {
  const map = new Map<number, string>();
  for (const it of items) if (!map.has(it.id)) map.set(it.id, it.label);
  return Array.from(map.entries())
    .map(([id, label]) => ({ id, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export default function TargetAnalysisScreen({ params }: { params?: { salesTargetId?: number; employeeId?: number; salesTargetAchievementId?: number } }) {
  // Set only when opened from a "TargetCompleted" notification tap — offers
  // an optional, skippable remark on that exact achievement. Not part of the
  // normal Target Analysis flow otherwise (there's no button to reopen this
  // for an arbitrary row).
  const [remarksAchievementId, setRemarksAchievementId] = useState<number | null>(params?.salesTargetAchievementId ?? null);
  // Opened from a "Target Achieved" notification tap (salesTargetId/employeeId
  // always set together in that case, never on a normal manual visit here) —
  // that notification is about one specific day's achievement, so land on
  // the Today view instead of the generic Week default.
  const [mode, setMode] = useState<TargetAnalysisMode>(() => (params?.salesTargetId || params?.employeeId ? 'today' : 'week'));
  const [offset, setOffset] = useState(0);
  const [rows, setRows] = useState<TargetAnalysisRow[]>([]);
  const [periodLabel, setPeriodLabel] = useState('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('employee');
  const [sortMode, setSortMode] = useState<SortMode>('default');
  const [openFilter, setOpenFilter] = useState<FilterKey | null>(null);

  // Pre-filtered straight to a specific achievement when opened from a
  // "TargetCompleted" notification tap — otherwise starts unfiltered as before.
  const [empIds, setEmpIds] = useState<Set<number>>(() => (params?.employeeId ? new Set([params.employeeId]) : new Set()));
  const [mgrIds, setMgrIds] = useState<Set<number>>(new Set());
  const [deptIds, setDeptIds] = useState<Set<number>>(new Set());
  const [branchIds, setBranchIds] = useState<Set<number>>(new Set());
  const [brandIds, setBrandIds] = useState<Set<number>>(new Set());
  const [targetIds, setTargetIds] = useState<Set<number>>(() => (params?.salesTargetId ? new Set([params.salesTargetId]) : new Set()));
  const [typeIds, setTypeIds] = useState<Set<number>>(new Set());
  const [scopeIds, setScopeIds] = useState<Set<number>>(new Set());
  const [ptypeIds, setPtypeIds] = useState<Set<number>>(new Set());
  const [perfIds, setPerfIds] = useState<Set<number>>(new Set());

  // AdminShell reuses the same mounted TargetAnalysisScreen instance across
  // consecutive notification taps (it's the same route key/component type at
  // the same JSX position, so React never remounts it) — the useState
  // initializers above only ever run once, on the very first mount. Without
  // this effect, tapping a SECOND "Target Achieved" notification while this
  // screen is already open would silently keep showing the FIRST tap's
  // filters/remark prompt instead of the new one.
  useEffect(() => {
    if (params?.employeeId) setEmpIds(new Set([params.employeeId]));
    if (params?.salesTargetId) setTargetIds(new Set([params.salesTargetId]));
    if (params?.salesTargetAchievementId) setRemarksAchievementId(params.salesTargetAchievementId);
    if (params?.salesTargetId || params?.employeeId) {
      setMode('today');
      setOffset(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params?.employeeId, params?.salesTargetId, params?.salesTargetAchievementId]);

  const load = useCallback(async (m: TargetAnalysisMode, o: number) => {
    setLoading(true);
    try {
      const res = await getTargetAnalysis(m, o);
      setRows(res.data.rows);
      setPeriodLabel(res.data.periodLabel);
    } catch {
      Alert.alert('Could not load Target Analysis');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(mode, offset);
  }, [mode, offset, load]);

  const changeMode = (m: TargetAnalysisMode) => {
    setMode(m);
    setOffset(0);
  };

  // Filter option universes rebuild from the CURRENT period's rows only — same
  // "no dead options" convention as the .NET filter bar.
  const empOptions = useMemo(
    () => uniqueOpts(rows.filter((r) => r.role !== 'Manager').map((r) => ({ id: r.employeeId, label: `${r.code ? r.code + ' - ' : ''}${r.employeeName}` }))),
    [rows]
  );
  const mgrOptions = useMemo(
    () => uniqueOpts(rows.filter((r) => r.role !== 'Employee').map((r) => ({ id: r.employeeId, label: `${r.code ? r.code + ' - ' : ''}${r.employeeName}` }))),
    [rows]
  );
  const deptOptions = useMemo(() => uniqueOpts(rows.flatMap((r) => r.deptIds.map((id, i) => ({ id, label: r.deptNames[i] })))), [rows]);
  const branchOptions = useMemo(() => uniqueOpts(rows.flatMap((r) => r.branchIds.map((id, i) => ({ id, label: r.branchNames[i] })))), [rows]);
  const brandOptions = useMemo(() => uniqueOpts(rows.flatMap((r) => r.brandIds.map((id, i) => ({ id, label: r.brandNames[i] })))), [rows]);
  const targetOptions = useMemo(() => uniqueOpts(rows.map((r) => ({ id: r.salesTargetId, label: r.targetName }))), [rows]);

  const activeFilterCount = empIds.size + mgrIds.size + deptIds.size + branchIds.size + brandIds.size + targetIds.size + typeIds.size + scopeIds.size + ptypeIds.size + perfIds.size;

  const clearFilters = () => {
    setEmpIds(new Set());
    setMgrIds(new Set());
    setDeptIds(new Set());
    setBranchIds(new Set());
    setBrandIds(new Set());
    setTargetIds(new Set());
    setTypeIds(new Set());
    setScopeIds(new Set());
    setPtypeIds(new Set());
    setPerfIds(new Set());
  };

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    const selTypes = new Set(Array.from(typeIds).map((id) => TYPE_BY_ID[id]));
    const selScopes = new Set(Array.from(scopeIds).map((id) => SCOPE_BY_ID[id]));
    const selPtypes = new Set(Array.from(ptypeIds).map((id) => PTYPE_BY_ID[id]));
    const selPerf = new Set(Array.from(perfIds).map((id) => PERF_BY_ID[id]));

    return rows.filter((r) => {
      if (s) {
        const hay = `${r.code || ''} ${r.employeeName} ${r.targetName} ${r.scopeLabel} ${r.brandNames.join(' ')}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      if (empIds.size && !(r.role !== 'Manager' && empIds.has(r.employeeId))) return false;
      if (mgrIds.size && !(r.role !== 'Employee' && mgrIds.has(r.employeeId))) return false;
      if (deptIds.size && !r.deptIds.some((id) => deptIds.has(id))) return false;
      if (branchIds.size && !r.branchIds.some((id) => branchIds.has(id))) return false;
      if (brandIds.size && !r.brandIds.some((id) => brandIds.has(id))) return false;
      if (targetIds.size && !targetIds.has(r.salesTargetId)) return false;
      if (selTypes.size && !selTypes.has(r.targetType)) return false;
      if (selScopes.size && !selScopes.has(r.salesScope)) return false;
      if (selPtypes.size && !selPtypes.has(r.personCategory)) return false;
      if (selPerf.size && !selPerf.has(r.bucket)) return false;
      return true;
    });
  }, [rows, search, empIds, mgrIds, deptIds, branchIds, brandIds, targetIds, typeIds, scopeIds, ptypeIds, perfIds]);

  const sorted = useMemo(() => {
    const arr = filtered.slice();
    if (sortMode === 'perf-desc') arr.sort((a, b) => b.primaryPct - a.primaryPct);
    else if (sortMode === 'perf-asc') arr.sort((a, b) => a.primaryPct - b.primaryPct);
    // 'default' keeps the server's highest-achieved-first ordering untouched.
    return arr;
  }, [filtered, sortMode]);

  const totals = useMemo(() => {
    const bucketCounts: Record<PerformanceBucket, number> = { top: 0, well: 0, avg: 0, under: 0, critical: 0 };
    let achievedValue = 0;
    let targetValue = 0;
    let achievedQty = 0;
    let targetQty = 0;
    let commission = 0;
    const seenTargets = new Set<number>();
    for (const r of filtered) {
      bucketCounts[r.bucket]++;
      commission += r.commissionEarned;
      // Value/Qty target totals sum PER-PERSON figures (matches the flat Employee-wise
      // total — Group mode's own per-target card shows the non-duplicated team total).
      achievedValue += r.totalValue;
      targetValue += r.targetValue;
      achievedQty += r.totalQty;
      targetQty += r.targetQty;
      seenTargets.add(r.salesTargetId);
    }
    const achPct = targetValue > 0 ? Math.round((achievedValue / targetValue) * 1000) / 10 : 0;
    const qtyPct = targetQty > 0 ? Math.round((achievedQty / targetQty) * 1000) / 10 : 0;
    return { bucketCounts, achievedValue, targetValue, achievedQty, targetQty, achPct, qtyPct, commission, targetCount: seenTargets.size, rowCount: filtered.length };
  }, [filtered]);

  const grouped = useMemo(() => buildGroups(sorted, viewMode), [sorted, viewMode]);

  return (
    <View style={styles.screen}>
      <View style={styles.periodRow}>
        <Pressable style={styles.periodArrow} onPress={() => setOffset((o) => o - 1)}>
          <Icon name="chevronLeft" size={18} color={A.ink} />
        </Pressable>
        <View style={styles.periodPills}>
          {(['today', 'week', 'month'] as TargetAnalysisMode[]).map((m) => (
            <Pressable key={m} style={[styles.periodPill, mode === m && styles.periodPillActive]} onPress={() => changeMode(m)}>
              <Text style={[styles.periodPillText, mode === m && styles.periodPillTextActive]}>{m === 'today' ? 'Day' : m === 'week' ? 'Week' : 'Month'}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable style={styles.periodArrow} onPress={() => setOffset((o) => o + 1)}>
          <Icon name="chevronRight" size={18} color={A.ink} />
        </Pressable>
      </View>
      <View style={styles.periodLabelRow}>
        {!!periodLabel && <Text style={styles.periodLabel}>{periodLabel}</Text>}
        {offset !== 0 && (
          <Pressable onPress={() => setOffset(0)}>
            <Text style={styles.todayLink}>Jump to Today</Text>
          </Pressable>
        )}
      </View>

      <TextInput style={styles.searchInput} placeholder="Search people, targets, brands..." placeholderTextColor={A.muted} value={search} onChangeText={setSearch} />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={{ gap: 8, paddingRight: 16 }}>
        <FilterChip label="Employee" count={empIds.size} onPress={() => setOpenFilter('emp')} />
        <FilterChip label="Manager" count={mgrIds.size} onPress={() => setOpenFilter('mgr')} />
        <FilterChip label="Department" count={deptIds.size} onPress={() => setOpenFilter('dept')} />
        <FilterChip label="Branch" count={branchIds.size} onPress={() => setOpenFilter('branch')} />
        <FilterChip label="Brand" count={brandIds.size} onPress={() => setOpenFilter('brand')} />
        <FilterChip label="Target Name" count={targetIds.size} onPress={() => setOpenFilter('target')} />
        <FilterChip label="Target Type" count={typeIds.size} onPress={() => setOpenFilter('type')} />
        <FilterChip label="Scope" count={scopeIds.size} onPress={() => setOpenFilter('scope')} />
        <FilterChip label="Person Type" count={ptypeIds.size} onPress={() => setOpenFilter('ptype')} />
        <FilterChip label="Performance" count={perfIds.size} onPress={() => setOpenFilter('perf')} />
        {activeFilterCount > 0 && (
          <Pressable style={styles.clearChip} onPress={clearFilters}>
            <Text style={styles.clearChipText}>Clear filters</Text>
          </Pressable>
        )}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.optionRow} contentContainerStyle={{ gap: 6 }}>
        {(['employee', 'target', 'group', 'perf'] as ViewMode[]).map((v) => (
          <Pressable key={v} style={[styles.optionChip, viewMode === v && styles.optionChipActive]} onPress={() => setViewMode(v)}>
            <Text style={[styles.optionChipText, viewMode === v && styles.optionChipTextActive]}>
              {v === 'employee' ? 'Employee wise' : v === 'target' ? 'Target wise' : v === 'group' ? 'Group (Distinct)' : 'Performance wise'}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.optionRow} contentContainerStyle={{ gap: 6 }}>
        {(['default', 'perf-desc', 'perf-asc'] as SortMode[]).map((v) => (
          <Pressable key={v} style={[styles.optionChip, sortMode === v && styles.optionChipActive]} onPress={() => setSortMode(v)}>
            <Text style={[styles.optionChipText, sortMode === v && styles.optionChipTextActive]}>
              {v === 'default' ? 'Sort: Default' : v === 'perf-desc' ? 'Sort: High to Low' : 'Sort: Low to High'}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {loading ? (
        <ActivityIndicator size="large" color={A.primary} style={{ marginTop: spacing(4) }} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <TotalsStrip totals={totals} />

          {sorted.length === 0 ? (
            <Text style={styles.emptyText}>No rows match this period/filters.</Text>
          ) : viewMode === 'group' ? (
            grouped.map((g) => <GroupCard key={g.key} group={g} />)
          ) : (
            grouped.map((g) => (
              <View key={g.key} style={{ marginBottom: 4 }}>
                {g.key !== '__flat__' && (
                  <View style={styles.groupHeader}>
                    <Text style={styles.groupHeaderText}>{g.label}</Text>
                    <View style={styles.groupCount}>
                      <Text style={styles.groupCountText}>{g.rows.length}</Text>
                    </View>
                  </View>
                )}
                {g.rows.map((r, i) => (
                  <AnalysisRowCard key={`${r.salesTargetId}-${r.employeeId}-${i}`} r={r} />
                ))}
              </View>
            ))
          )}
        </ScrollView>
      )}

      <MultiSelectPickerModal visible={openFilter === 'emp'} title="Filter by Employee" options={empOptions} selectedIds={empIds} onChange={setEmpIds} onClose={() => setOpenFilter(null)} />
      <MultiSelectPickerModal visible={openFilter === 'mgr'} title="Filter by Manager" options={mgrOptions} selectedIds={mgrIds} onChange={setMgrIds} onClose={() => setOpenFilter(null)} />
      <MultiSelectPickerModal visible={openFilter === 'dept'} title="Filter by Department" options={deptOptions} selectedIds={deptIds} onChange={setDeptIds} onClose={() => setOpenFilter(null)} />
      <MultiSelectPickerModal visible={openFilter === 'branch'} title="Filter by Branch" options={branchOptions} selectedIds={branchIds} onChange={setBranchIds} onClose={() => setOpenFilter(null)} />
      <MultiSelectPickerModal visible={openFilter === 'brand'} title="Filter by Brand" options={brandOptions} selectedIds={brandIds} onChange={setBrandIds} onClose={() => setOpenFilter(null)} />
      <MultiSelectPickerModal visible={openFilter === 'target'} title="Filter by Target Name" options={targetOptions} selectedIds={targetIds} onChange={setTargetIds} onClose={() => setOpenFilter(null)} />
      <MultiSelectPickerModal visible={openFilter === 'type'} title="Filter by Target Type" options={TYPE_OPTS} selectedIds={typeIds} onChange={setTypeIds} onClose={() => setOpenFilter(null)} />
      <MultiSelectPickerModal visible={openFilter === 'scope'} title="Filter by Scope" options={SCOPE_OPTS} selectedIds={scopeIds} onChange={setScopeIds} onClose={() => setOpenFilter(null)} />
      <MultiSelectPickerModal visible={openFilter === 'ptype'} title="Filter by Person Type" options={PTYPE_OPTS} selectedIds={ptypeIds} onChange={setPtypeIds} onClose={() => setOpenFilter(null)} />
      <MultiSelectPickerModal visible={openFilter === 'perf'} title="Filter by Performance" options={PERF_OPTS} selectedIds={perfIds} onChange={setPerfIds} onClose={() => setOpenFilter(null)} />

      {remarksAchievementId != null && (
        <TargetRemarkModal achievementId={remarksAchievementId} onClose={() => setRemarksAchievementId(null)} />
      )}
    </View>
  );
}

/**
 * Optional, skippable — see TargetAnalysisScreen's own doc comment on
 * remarksAchievementId. One-tap fixed "Good job!" (no typing) per explicit
 * request; sendGoodJobRemark() is idempotent server-side, so this only ever
 * results in one push to the employee no matter how many times this modal
 * is opened for the same achievement.
 *
 * Checks status FIRST (getGoodJobStatus) before showing anything — most
 * achievements are now auto-sent 3 minutes after they happen
 * (adminTargetRemarkService.js's autoSendGoodJobForRecent), so by the time an
 * admin actually opens the notification it's very often already done. In
 * that case this skips straight to the confirmation state (with the
 * clapping sound) instead of showing a "Send Good job?" prompt for
 * something that already happened — genuinely-fresh achievements (opened
 * within that first 3-minute window) still get the normal optional prompt.
 * Plays the clapping sound on BOTH a fresh manual send and an
 * already-auto-sent confirmation — the sound is the admin's own "yes, this
 * happened" cue either way, not just a reward for tapping Send.
 */
function TargetRemarkModal({ achievementId, onClose }: { achievementId: number; onClose: () => void }) {
  const [sending, setSending] = useState(false);
  const [checking, setChecking] = useState(true);
  const [sentState, setSentState] = useState<'idle' | 'sent' | 'alreadySent'>('idle');
  const [isAuto, setIsAuto] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getGoodJobStatus(achievementId);
        if (cancelled) return;
        if (res.data.alreadySent) {
          setIsAuto(res.data.isAuto);
          setSentState('alreadySent');
        }
      } catch {
        // Status check failing just falls through to the normal "Send Good job?" prompt.
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [achievementId]);

  useEffect(() => {
    if (checking || sentState === 'idle') return undefined;
    const sound = new Sound('clapping.mp3', Sound.MAIN_BUNDLE, (err) => {
      if (!err) sound.play(() => sound.release());
    });
    return () => {
      sound.stop(() => sound.release());
    };
  }, [checking, sentState]);

  const send = async () => {
    setSending(true);
    try {
      const res = await sendGoodJobRemark(achievementId);
      setIsAuto(false);
      setSentState(res.data.alreadySent ? 'alreadySent' : 'sent');
    } catch (err: any) {
      Alert.alert('Could not send', err?.response?.data?.message || 'Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.remarkBackdrop} onPress={onClose}>
        <Pressable style={styles.remarkBox} onPress={(e) => e.stopPropagation()}>
          {checking ? (
            <ActivityIndicator size="large" color={A.primary} />
          ) : sentState === 'idle' ? (
            <>
              <Text style={styles.remarkTitle}>Send "Good job!" to this employee?</Text>
              <Text style={styles.remarkSub}>Entirely optional — skip if you'd rather not.</Text>
              <View style={styles.remarkActions}>
                <Button title="Skip" variant="outline" onPress={onClose} style={{ flex: 1 }} disabled={sending} />
                <Button title={`Send "Good job!"`} onPress={send} loading={sending} style={{ flex: 1 }} />
              </View>
            </>
          ) : (
            <>
              <Text style={styles.remarkEmoji}>👏</Text>
              <Text style={styles.remarkTitle}>{isAuto ? '"Good job!" sent automatically' : sentState === 'alreadySent' ? 'Already sent' : '"Good job!" sent'}</Text>
              <Text style={styles.remarkSub}>
                {isAuto
                  ? 'This was sent automatically 3 minutes after the achievement — no action needed.'
                  : sentState === 'alreadySent'
                  ? "You've already sent this for this achievement."
                  : 'The employee has been notified.'}
              </Text>
              <Button title="Done" onPress={onClose} style={{ marginTop: spacing(1) }} />
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Grouping ────────────────────────────────────────────────────────────

type Group = { key: string; label: string; rows: TargetAnalysisRow[] };

function buildGroups(rows: TargetAnalysisRow[], viewMode: ViewMode): Group[] {
  if (viewMode === 'employee') return [{ key: '__flat__', label: '', rows }];

  if (viewMode === 'target' || viewMode === 'group') {
    const map = new Map<number, Group>();
    for (const r of rows) {
      if (!map.has(r.salesTargetId)) map.set(r.salesTargetId, { key: String(r.salesTargetId), label: r.targetName, rows: [] });
      map.get(r.salesTargetId)!.rows.push(r);
    }
    return Array.from(map.values());
  }

  // perf — grouped by bucket, in fixed top->critical order.
  const map = new Map<PerformanceBucket, Group>();
  for (const b of BUCKET_ORDER) map.set(b, { key: b, label: BUCKET_LABEL[b], rows: [] });
  for (const r of rows) map.get(r.bucket)!.rows.push(r);
  return Array.from(map.values()).filter((g) => g.rows.length > 0);
}

// ── Sub-components ─────────────────────────────────────────────────────

type Totals = {
  bucketCounts: Record<PerformanceBucket, number>;
  achievedValue: number;
  targetValue: number;
  achievedQty: number;
  targetQty: number;
  achPct: number;
  qtyPct: number;
  commission: number;
  targetCount: number;
  rowCount: number;
};

function TotalsStrip({ totals }: { totals: Totals }) {
  return (
    <View style={styles.totalsStrip}>
      <TotalCard label="Rows" value={String(totals.rowCount)} sub={`${totals.targetCount} target(s)`} />
      {totals.targetValue > 0 && <TotalCard label="Value Achieved" value={money(totals.achievedValue)} sub={`of ${money(totals.targetValue)} · ${totals.achPct}%`} pct={totals.achPct} />}
      {totals.targetQty > 0 && <TotalCard label="Qty Achieved" value={`${Math.round(totals.achievedQty)}`} sub={`of ${Math.round(totals.targetQty)} · ${totals.qtyPct}%`} pct={totals.qtyPct} />}
      <TotalCard label="Commission Earned" value={money(totals.commission)} />
      <View style={styles.bucketChipsWrap}>
        {BUCKET_ORDER.filter((b) => totals.bucketCounts[b] > 0).map((b) => (
          <View key={b} style={[styles.bucketChip, { backgroundColor: BUCKET_COLOR[b] + '1a' }]}>
            <View style={[styles.bucketDot, { backgroundColor: BUCKET_COLOR[b] }]} />
            <Text style={[styles.bucketChipText, { color: BUCKET_COLOR[b] }]}>
              {BUCKET_LABEL[b]} ({totals.bucketCounts[b]})
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
function TotalCard({ label, value, sub, pct }: { label: string; value: string; sub?: string; pct?: number }) {
  const color = pct == null ? A.ink : pct >= 100 ? '#16a34a' : pct >= 70 ? '#d97706' : '#dc2626';
  return (
    <View style={styles.totalCard}>
      <Text style={styles.totalCardLabel}>{label}</Text>
      <Text style={[styles.totalCardValue, { color }]}>{value}</Text>
      {!!sub && <Text style={styles.totalCardSub}>{sub}</Text>}
    </View>
  );
}

function GroupCard({ group }: { group: Group }) {
  const first = group.rows[0];
  if (!first) return null;
  const pct = first.targetType === 'Qty' ? (first.teamTargetQty > 0 ? Math.round((first.teamAchievedQty / first.teamTargetQty) * 1000) / 10 : 0) : first.teamTargetValue > 0 ? Math.round((first.teamAchievedValue / first.teamTargetValue) * 1000) / 10 : 0;
  return (
    <Card style={styles.groupCard}>
      <View style={styles.groupCardHead}>
        <Text style={styles.groupCardTitle} numberOfLines={1}>
          {group.label}
        </Text>
        <View style={[styles.bucketPill, { backgroundColor: BUCKET_COLOR[first.bucket] + '1a' }]}>
          <Text style={[styles.bucketPillText, { color: BUCKET_COLOR[first.bucket] }]}>{BUCKET_LABEL[first.bucket]}</Text>
        </View>
      </View>
      <Text style={styles.groupCardSub}>
        {first.scopeLabel} · {first.brandNames.length ? first.brandNames.join(', ') : 'No brands'}
      </Text>

      {first.teamTargetValue > 0 && <MetricRow label="Team Value" achieved={first.teamAchievedValue} target={first.teamTargetValue} pct={pct} money />}
      {first.teamTargetQty > 0 && <MetricRow label="Team Qty" achieved={first.teamAchievedQty} target={first.teamTargetQty} pct={first.teamTargetQty > 0 ? Math.round((first.teamAchievedQty / first.teamTargetQty) * 1000) / 10 : 0} />}

      <View style={styles.footerRow}>
        <Text style={styles.commissionText}>Team Commission: {money(first.teamCommissionEarned)}</Text>
      </View>

      <View style={styles.groupEmployees}>
        {group.rows.map((r, i) => (
          <View key={i} style={[styles.groupEmpChip, r.role === 'Manager' && styles.groupEmpChipMgr, r.role === 'Employee+Manager' && styles.groupEmpChipBoth]}>
            <Text style={styles.groupEmpChipText} numberOfLines={1}>
              {r.employeeName}
            </Text>
            <Text style={styles.groupEmpChipSub}>{r.primaryPct}%</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

function AnalysisRowCard({ r }: { r: TargetAnalysisRow }) {
  return (
    <Card style={styles.card}>
      <View style={styles.cardTop}>
        <View style={[styles.avatar, r.role === 'Manager' && styles.avatarManager, r.role === 'Employee+Manager' && styles.avatarBoth]}>
          <Text style={styles.avatarText}>{(r.employeeName || '?').charAt(0).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.empName} numberOfLines={1}>
            {r.code ? `${r.code} · ` : ''}
            {r.employeeName}
            {r.personCategory === 'attached' && <Text style={styles.attachedBadge}> 🔗 Attached</Text>}
          </Text>
          <Text style={styles.targetLine} numberOfLines={1}>
            {r.targetName} · {r.scopeLabel}
            {r.role !== 'Employee' ? ` · ${r.role}` : ''}
          </Text>
        </View>
        <View style={[styles.bucketPill, { backgroundColor: BUCKET_COLOR[r.bucket] + '1a' }]}>
          <Text style={[styles.bucketPillText, { color: BUCKET_COLOR[r.bucket] }]}>{BUCKET_LABEL[r.bucket]}</Text>
        </View>
      </View>

      {r.targetValue > 0 && <MetricRow label="Value" achieved={r.totalValue} target={r.targetValue} pct={r.achValuePct} money />}
      {r.targetQty > 0 && <MetricRow label="Qty" achieved={r.totalQty} target={r.targetQty} pct={r.achQtyPct} />}

      <View style={styles.footerRow}>
        <Text style={styles.commissionText}>
          Commission: {money(r.commissionEarned)} · Qty Sold: {Math.round(r.totalQty)}
        </Text>
        <Text style={[styles.achievedText, { color: r.achieved ? '#16a34a' : A.muted }]}>{r.achieved ? '✓ Achieved' : 'Not yet'}</Text>
      </View>
    </Card>
  );
}

function MetricRow({ label, achieved, target, pct, money: isMoney }: { label: string; achieved: number; target: number; pct: number; money?: boolean }) {
  const color = pct >= 100 ? '#16a34a' : pct >= 60 ? '#d97706' : '#e11d48';
  const fmt = (n: number) => (isMoney ? money(n) : String(Math.round(n)));
  return (
    <View style={styles.metricRow}>
      <View style={styles.metricHeadRow}>
        <Text style={styles.metricLabel}>{label}</Text>
        <Text style={styles.metricValue}>
          {fmt(achieved)} / {fmt(target)} · <Text style={{ color }}>{pct}%</Text>
        </Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressBar, { width: `${Math.min(100, pct)}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
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
  remarkBackdrop: { flex: 1, backgroundColor: 'rgba(15,13,35,0.5)', alignItems: 'center', justifyContent: 'center', padding: spacing(3) },
  remarkBox: { width: '100%', backgroundColor: A.surface, borderRadius: radius.md, padding: spacing(2.5) },
  remarkEmoji: { fontSize: 36, textAlign: 'center', marginBottom: 8 },
  remarkTitle: { fontSize: 16, fontWeight: '800', color: A.ink, marginBottom: 4, textAlign: 'center' },
  remarkSub: { fontSize: 12, color: A.muted, marginBottom: spacing(1.5), textAlign: 'center' },
  remarkActions: { flexDirection: 'row', gap: 10, marginTop: spacing(1) },
  periodRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: spacing(2), paddingBottom: 6 },
  periodArrow: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: A.surface, borderWidth: 1, borderColor: A.border },
  periodPills: { flex: 1, flexDirection: 'row', backgroundColor: A.surfaceRaised, borderRadius: radius.sm, padding: 3, gap: 3 },
  periodPill: { flex: 1, paddingVertical: 8, borderRadius: radius.sm - 2, alignItems: 'center' },
  periodPillActive: { backgroundColor: A.primary },
  periodPillText: { fontSize: 12, fontWeight: '700', color: A.muted },
  periodPillTextActive: { color: '#fff' },
  periodLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: spacing(1) },
  periodLabel: { textAlign: 'center', fontSize: 12, color: A.muted, fontWeight: '600' },
  todayLink: { fontSize: 11, color: A.primary, fontWeight: '700' },

  searchInput: {
    marginHorizontal: spacing(2),
    height: 40,
    borderWidth: 1,
    borderColor: A.border,
    borderRadius: radius.sm,
    backgroundColor: A.surface,
    paddingHorizontal: 12,
    color: A.ink,
    fontSize: 13,
    marginBottom: spacing(1),
  },

  filterRow: { paddingLeft: spacing(2), marginBottom: 8, flexGrow: 0 },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 30, paddingHorizontal: 11, borderRadius: 999, borderWidth: 1, borderColor: A.border, backgroundColor: A.surface },
  filterChipActive: { borderColor: A.primary, backgroundColor: A.primary + '12' },
  filterChipText: { fontSize: 11, fontWeight: '700', color: A.muted },
  filterChipTextActive: { color: A.primary },
  filterChipBadge: { minWidth: 15, height: 15, borderRadius: 8, backgroundColor: A.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  filterChipBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  clearChip: { height: 30, paddingHorizontal: 11, borderRadius: 999, borderWidth: 1, borderColor: '#fca5a5', backgroundColor: '#fef2f2', alignItems: 'center', justifyContent: 'center' },
  clearChipText: { color: '#dc2626', fontSize: 11, fontWeight: '700' },

  optionRow: { paddingLeft: spacing(2), marginBottom: 8, flexGrow: 0 },
  optionChip: { height: 28, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, borderColor: A.border, backgroundColor: A.surface, alignItems: 'center', justifyContent: 'center' },
  optionChipActive: { backgroundColor: A.primary, borderColor: A.primary },
  optionChipText: { fontSize: 10.5, fontWeight: '700', color: A.muted },
  optionChipTextActive: { color: '#fff' },

  content: { padding: spacing(2), paddingTop: 4 },
  emptyText: { color: A.muted, fontSize: 13, textAlign: 'center', marginTop: spacing(4) },

  totalsStrip: { marginBottom: spacing(1.5) },
  totalCard: { backgroundColor: A.surface, borderWidth: 1, borderColor: A.border, borderRadius: radius.sm, padding: 10, marginBottom: 8 },
  totalCardLabel: { fontSize: 10, fontWeight: '700', color: A.muted, textTransform: 'uppercase', marginBottom: 3 },
  totalCardValue: { fontSize: 16, fontWeight: '800' },
  totalCardSub: { fontSize: 10.5, color: A.muted, marginTop: 2 },
  bucketChipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2, marginBottom: 4 },
  bucketChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  bucketDot: { width: 6, height: 6, borderRadius: 3 },
  bucketChipText: { fontSize: 10.5, fontWeight: '700' },

  groupHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: A.surfaceRaised, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 8, marginTop: 6, marginBottom: 8 },
  groupHeaderText: { fontSize: 12.5, fontWeight: '800', color: A.ink },
  groupCount: { backgroundColor: A.surface, borderWidth: 1, borderColor: A.border, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  groupCountText: { fontSize: 10.5, fontWeight: '700', color: A.muted },

  groupCard: { marginBottom: 12 },
  groupCardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 },
  groupCardTitle: { flex: 1, fontSize: 14, fontWeight: '800', color: A.ink },
  groupCardSub: { fontSize: 11, color: A.muted, marginBottom: 8 },
  groupEmployees: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  groupEmpChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: A.surfaceRaised, borderWidth: 1, borderColor: A.border, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4, maxWidth: '48%' },
  groupEmpChipMgr: { backgroundColor: '#fef3c7', borderColor: '#fde68a' },
  groupEmpChipBoth: { backgroundColor: '#ede9fe', borderColor: '#ddd6fe' },
  groupEmpChipText: { fontSize: 11, fontWeight: '700', color: A.ink },
  groupEmpChipSub: { fontSize: 10, fontWeight: '700', color: A.muted },

  card: { marginBottom: 12 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: A.primary + '20', alignItems: 'center', justifyContent: 'center' },
  avatarManager: { backgroundColor: '#fef3c7' },
  avatarBoth: { backgroundColor: '#ede9fe' },
  avatarText: { color: A.primary, fontWeight: '800', fontSize: 14 },
  empName: { fontSize: 13, fontWeight: '800', color: A.ink },
  attachedBadge: { fontSize: 10, fontWeight: '700', color: '#15803d' },
  targetLine: { fontSize: 11, color: A.muted, marginTop: 2 },
  bucketPill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  bucketPillText: { fontSize: 9.5, fontWeight: '800' },

  metricRow: { marginBottom: 8 },
  metricHeadRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  metricLabel: { fontSize: 11, color: A.muted, fontWeight: '700' },
  metricValue: { fontSize: 11, color: A.ink, fontWeight: '700' },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: A.surfaceRaised, overflow: 'hidden' },
  progressBar: { height: 6 },

  footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, paddingTop: 8, borderTopWidth: 1, borderTopColor: A.border },
  commissionText: { fontSize: 12, fontWeight: '700', color: A.ink },
  achievedText: { fontSize: 11, fontWeight: '700' },
});
