import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Icon from '../../components/Icon';
import { colors, radius } from '../../theme';
import { ScannerAccessEmployee, getScannerAccess, saveScannerAccess } from '../../api/adminScannerAccessApi';

const A = colors.admin;
type Show = 'all' | 'assigned' | 'notAssigned';
type FilterKey = 'department' | 'location' | 'designation';
const FILTER_LABELS: Record<FilterKey, string> = { department: 'Department', location: 'Location', designation: 'Designation' };

/**
 * Scanner App Access — pick the employees who may log in to the aScanner app
 * (mobile + OTP). Same list as the web Panel's Settings > Scanner App Access.
 * The admin mobiles always have access and aren't listed here.
 */
export default function ScannerAccessScreen() {
  const [employees, setEmployees] = useState<ScannerAccessEmployee[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [saved, setSaved] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [show, setShow] = useState<Show>('all');
  const [filters, setFilters] = useState<Record<FilterKey, string>>({ department: '', location: '', designation: '' });
  const [picker, setPicker] = useState<FilterKey | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getScannerAccess();
      const list = res.data.employees || [];
      const on = new Set(list.filter((e) => e.assigned).map((e) => e.employeeId));
      setEmployees(list);
      setSelected(on);
      setSaved(new Set(on));
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Could not load employees.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const options = useMemo(() => {
    const uniq = (k: FilterKey) => Array.from(new Set(employees.map((e) => e[k]).filter(Boolean))).sort((a, b) => a.localeCompare(b));
    return { department: uniq('department'), location: uniq('location'), designation: uniq('designation') };
  }, [employees]);

  const visible = useMemo(() => {
    const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return employees.filter((e) => {
      if (show === 'assigned' && !selected.has(e.employeeId)) return false;
      if (show === 'notAssigned' && selected.has(e.employeeId)) return false;
      for (const k of Object.keys(filters) as FilterKey[]) if (filters[k] && e[k] !== filters[k]) return false;
      if (!words.length) return true;
      const hay = `${e.name} ${e.code} ${e.mobile}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }, [employees, search, show, filters, selected]);

  const dirty = selected.size !== saved.size || [...selected].some((id) => !saved.has(id));
  const allVisibleOn = visible.length > 0 && visible.every((e) => selected.has(e.employeeId));

  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleVisible = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      visible.forEach((e) => (allVisibleOn ? next.delete(e.employeeId) : next.add(e.employeeId)));
      return next;
    });

  const onSave = async () => {
    setSaving(true);
    try {
      const res = await saveScannerAccess([...selected]);
      setSaved(new Set(selected));
      Alert.alert('Saved', `${res.data.count} employee${res.data.count === 1 ? '' : 's'} can now log in to aScanner.`);
    } catch (e: any) {
      Alert.alert('Could not save', e?.response?.data?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={A.primary} />
      </View>
    );
  }

  const activeFilters = (Object.keys(filters) as FilterKey[]).filter((k) => filters[k]).length;

  return (
    <View style={styles.screen}>
      <FlatList
        data={visible}
        keyExtractor={(e) => String(e.employeeId)}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        initialNumToRender={20}
        ListHeaderComponent={
          <View>
            <View style={styles.info}>
              <Icon name="phone" size={18} color={A.primary} />
              <Text style={styles.infoText}>
                Selected employees can log in to the aScanner app with their mobile number + OTP. The admin numbers always have access.
              </Text>
            </View>
            {!!error && <Text style={styles.error}>{error}</Text>}

            <View style={styles.searchBox}>
              <Icon name="search" size={18} color={A.muted} />
              <TextInput
                style={styles.searchInput}
                value={search}
                onChangeText={setSearch}
                placeholder="Search name, code or mobile"
                placeholderTextColor={A.muted}
                autoCorrect={false}
              />
              {!!search && (
                <Pressable onPress={() => setSearch('')} hitSlop={8}>
                  <Icon name="x" size={16} color={A.muted} />
                </Pressable>
              )}
            </View>

            <View style={styles.filterRow}>
              {(Object.keys(FILTER_LABELS) as FilterKey[]).map((k) => (
                <Pressable key={k} style={[styles.filterBtn, !!filters[k] && styles.filterBtnOn]} onPress={() => setPicker(k)}>
                  <Text style={[styles.filterText, !!filters[k] && styles.filterTextOn]} numberOfLines={1}>
                    {filters[k] || FILTER_LABELS[k]}
                  </Text>
                  <Icon name="chevronDown" size={14} color={filters[k] ? '#fff' : A.muted} />
                </Pressable>
              ))}
            </View>

            <View style={styles.segment}>
              {(
                [
                  ['all', `All (${employees.length})`],
                  ['assigned', `Assigned (${selected.size})`],
                  ['notAssigned', 'Not assigned'],
                ] as [Show, string][]
              ).map(([k, label]) => (
                <Pressable key={k} style={[styles.segBtn, show === k && styles.segBtnOn]} onPress={() => setShow(k)}>
                  <Text style={[styles.segText, show === k && styles.segTextOn]}>{label}</Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.bulkRow}>
              <Text style={styles.countText}>
                {visible.length} shown{activeFilters ? ` · ${activeFilters} filter${activeFilters === 1 ? '' : 's'}` : ''}
              </Text>
              <View style={{ flexDirection: 'row', gap: 16 }}>
                {activeFilters > 0 && (
                  <Pressable onPress={() => setFilters({ department: '', location: '', designation: '' })} hitSlop={8}>
                    <Text style={styles.link}>Clear filters</Text>
                  </Pressable>
                )}
                {visible.length > 0 && (
                  <Pressable onPress={toggleVisible} hitSlop={8}>
                    <Text style={styles.link}>{allVisibleOn ? 'Unselect shown' : 'Select shown'}</Text>
                  </Pressable>
                )}
              </View>
            </View>
          </View>
        }
        ListEmptyComponent={<Text style={styles.empty}>No employee matches.</Text>}
        renderItem={({ item: e }) => {
          const on = selected.has(e.employeeId);
          return (
            <Pressable style={[styles.row, on && styles.rowOn]} onPress={() => toggle(e.employeeId)}>
              <View style={[styles.check, on && styles.checkOn]}>{on && <Icon name="check" size={14} color="#fff" />}</View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>
                  {e.name}
                  {e.code ? <Text style={styles.code}>  ({e.code})</Text> : null}
                </Text>
                <Text style={[styles.meta, !e.mobile && { color: '#dc2626' }]}>{e.mobile ? `+91 ${e.mobile}` : 'No mobile number — cannot get OTP'}</Text>
                <Text style={styles.meta} numberOfLines={1}>
                  {[e.department, e.designation, e.location].filter(Boolean).join(' · ') || '—'}
                </Text>
              </View>
              {e.status !== 'Active' && !!e.status && (
                <View style={styles.statusPill}>
                  <Text style={styles.statusText}>{e.status}</Text>
                </View>
              )}
            </Pressable>
          );
        }}
      />

      <View style={styles.footer}>
        <Text style={styles.footerText}>{selected.size} selected</Text>
        <Pressable style={[styles.saveBtn, (!dirty || saving) && { opacity: 0.5 }]} onPress={onSave} disabled={!dirty || saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Save access</Text>}
        </Pressable>
      </View>

      <Modal visible={!!picker} transparent animationType="fade" onRequestClose={() => setPicker(null)}>
        <Pressable style={styles.backdrop} onPress={() => setPicker(null)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>{picker ? FILTER_LABELS[picker] : ''}</Text>
            <FlatList
              data={['', ...(picker ? options[picker] : [])]}
              keyExtractor={(v) => v || '__all'}
              style={{ maxHeight: 380 }}
              renderItem={({ item: v }) => {
                const on = picker ? filters[picker] === v : false;
                return (
                  <Pressable
                    style={styles.optRow}
                    onPress={() => {
                      if (picker) setFilters((f) => ({ ...f, [picker]: v }));
                      setPicker(null);
                    }}
                  >
                    <Text style={[styles.optText, on && { color: A.primary, fontWeight: '800' }]}>{v || `All ${picker ? FILTER_LABELS[picker] : ''}s`}</Text>
                    {on && <Icon name="check" size={16} color={A.primary} />}
                  </Pressable>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: A.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 14, paddingBottom: 20 },
  info: { flexDirection: 'row', gap: 10, backgroundColor: A.surface, borderRadius: radius.md, borderWidth: 1, borderColor: A.border, padding: 12, marginBottom: 12 },
  infoText: { flex: 1, color: A.ink, fontSize: 12, lineHeight: 17 },
  error: { color: '#dc2626', fontSize: 12, marginBottom: 10 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: A.surface, borderRadius: radius.sm, borderWidth: 1, borderColor: A.border, paddingHorizontal: 12, height: 46 },
  searchInput: { flex: 1, color: A.ink, fontSize: 14 },
  filterRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  filterBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4, backgroundColor: A.surface, borderRadius: radius.sm, borderWidth: 1, borderColor: A.border, paddingHorizontal: 10, height: 38 },
  filterBtnOn: { backgroundColor: A.primary, borderColor: A.primary },
  filterText: { flex: 1, color: A.ink, fontSize: 12, fontWeight: '600' },
  filterTextOn: { color: '#fff' },
  segment: { flexDirection: 'row', backgroundColor: A.surfaceRaised, borderRadius: radius.sm, padding: 3, marginTop: 10 },
  segBtn: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 8 },
  segBtnOn: { backgroundColor: A.surface },
  segText: { color: A.muted, fontSize: 12, fontWeight: '700' },
  segTextOn: { color: A.primary },
  bulkRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, marginBottom: 6 },
  countText: { color: A.muted, fontSize: 12 },
  link: { color: A.primary, fontSize: 13, fontWeight: '700' },
  empty: { color: A.muted, textAlign: 'center', marginTop: 30 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: A.surface, borderRadius: radius.sm, borderWidth: 1, borderColor: A.border, padding: 12, marginTop: 8 },
  rowOn: { borderColor: A.primary },
  check: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: A.border, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: A.primary, borderColor: A.primary },
  name: { color: A.ink, fontSize: 14, fontWeight: '700' },
  code: { color: A.muted, fontSize: 12, fontWeight: '500' },
  meta: { color: A.muted, fontSize: 12, marginTop: 2 },
  statusPill: { backgroundColor: '#fef3c7', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  statusText: { color: '#b45309', fontSize: 11, fontWeight: '700' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: A.surface, borderTopWidth: 1, borderTopColor: A.border, padding: 12 },
  footerText: { color: A.ink, fontSize: 14, fontWeight: '700' },
  saveBtn: { backgroundColor: A.primary, borderRadius: radius.sm, paddingHorizontal: 22, height: 44, alignItems: 'center', justifyContent: 'center' },
  saveText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,15,35,0.5)', justifyContent: 'center', padding: 20 },
  sheet: { backgroundColor: A.surface, borderRadius: radius.md, padding: 16 },
  sheetTitle: { color: A.ink, fontSize: 16, fontWeight: '800', marginBottom: 8 },
  optRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: A.border },
  optText: { color: A.ink, fontSize: 14 },
});
