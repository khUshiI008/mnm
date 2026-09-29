import React, { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Icon from '../Icon';
import { colors, radius, spacing } from '../../theme';

const A = colors.admin;

export type MultiSelectOption = { id: number; label: string; sub?: string };

type Props = {
  visible: boolean;
  title: string;
  options: MultiSelectOption[];
  selectedIds: Set<number>;
  onChange: (ids: Set<number>) => void;
  onClose: () => void;
  /** Shown under the title, e.g. "Empty = all brands". */
  emptyMeansAllHint?: string;
};

/**
 * Reusable searchable multi-select checklist — combines EmployeeFilterModal's search
 * input with the Set<number> + toggle-checklist idiom already used inline in
 * ShiftHierarchyScreen.tsx, extracted here since Target Generate needs the same
 * picker 5 times (Brands/Departments/Branches/Employees/Managers).
 */
export default function MultiSelectPickerModal({ visible, title, options, selectedIds, onChange, onClose, emptyMeansAllHint }: Props) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return options;
    return options.filter((o) => o.label.toLowerCase().includes(s) || o.sub?.toLowerCase().includes(s));
  }, [options, search]);

  const toggle = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };

  const selectAll = () => onChange(new Set(options.map((o) => o.id)));
  const clearAll = () => onChange(new Set());

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{title}</Text>
              {!!emptyMeansAllHint && <Text style={styles.hint}>{emptyMeansAllHint}</Text>}
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Icon name="x" size={18} color={A.muted} />
            </Pressable>
          </View>

          <TextInput style={styles.search} value={search} onChangeText={setSearch} placeholder="Search..." placeholderTextColor={A.muted} />

          <View style={styles.actionsRow}>
            <Text style={styles.countText}>{selectedIds.size} selected</Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Pressable onPress={selectAll}>
                <Text style={styles.actionLink}>Select All</Text>
              </Pressable>
              <Pressable onPress={clearAll}>
                <Text style={styles.actionLink}>Clear</Text>
              </Pressable>
            </View>
          </View>

          <FlatList
            data={filtered}
            keyExtractor={(o) => String(o.id)}
            style={{ maxHeight: 340 }}
            renderItem={({ item }) => {
              const checked = selectedIds.has(item.id);
              return (
                <Pressable style={styles.row} onPress={() => toggle(item.id)}>
                  <View style={[styles.checkbox, checked && styles.checkboxChecked]}>{checked ? <Text style={styles.checkmark}>✓</Text> : null}</View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowText}>{item.label}</Text>
                    {!!item.sub && <Text style={styles.rowSub}>{item.sub}</Text>}
                  </View>
                </Pressable>
              );
            }}
            ListEmptyComponent={<Text style={styles.emptyText}>No matches.</Text>}
          />

          <Pressable style={styles.doneBtn} onPress={onClose}>
            <Text style={styles.doneBtnText}>Done</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,15,35,0.5)', justifyContent: 'center', padding: spacing(2) },
  sheet: { backgroundColor: A.surface, borderRadius: radius.md, padding: 16, maxHeight: '80%' },
  header: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  title: { fontSize: 15, fontWeight: '800', color: A.ink },
  hint: { fontSize: 11, color: A.muted, marginTop: 2 },
  closeBtn: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: A.surfaceRaised },
  search: { borderWidth: 1, borderColor: A.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, color: A.ink, marginBottom: 8 },
  actionsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  countText: { fontSize: 11, color: A.muted, fontWeight: '600' },
  actionLink: { fontSize: 12, color: A.primary, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: A.border },
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: A.border, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: A.primary, borderColor: A.primary },
  checkmark: { color: '#fff', fontSize: 12, fontWeight: '800' },
  rowText: { fontSize: 13, color: A.ink, fontWeight: '600' },
  rowSub: { fontSize: 11, color: A.muted, marginTop: 1 },
  emptyText: { textAlign: 'center', color: A.muted, fontSize: 13, paddingVertical: 20 },
  doneBtn: { marginTop: 10, backgroundColor: A.primary, borderRadius: radius.sm, paddingVertical: 12, alignItems: 'center' },
  doneBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
