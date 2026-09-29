import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Picker } from '../../components/AppPicker';
import Button from '../../components/Button';
import { colors, radius, shadow, spacing } from '../../theme';
import {
  deleteShiftHierarchyMapping,
  getChildIdsForParent,
  getShiftHierarchyDropdown,
  getShiftHierarchyGrid,
  saveShiftHierarchyMapping,
  ShiftDropdownOption,
  ShiftHierarchyMapping,
} from '../../api/adminShiftHierarchyApi';

const A = colors.admin;

export default function ShiftHierarchyScreen() {
  const [search, setSearch] = useState('');
  const [mappings, setMappings] = useState<ShiftHierarchyMapping[]>([]);
  const [total, setTotal] = useState(0);
  const [shiftOptions, setShiftOptions] = useState<ShiftDropdownOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [formTarget, setFormTarget] = useState<{ parentShiftId?: number } | null>(null);

  const load = useCallback(async (term?: string) => {
    setLoading(true);
    try {
      const res = await getShiftHierarchyGrid({ search: term, page: 0, pageSize: 100 });
      setMappings(res.data.mappings);
      setTotal(res.data.total);
    } catch {
      Alert.alert('Could not load shift hierarchy mappings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    getShiftHierarchyDropdown().then((res) => setShiftOptions(res.data.shifts)).catch(() => {});
    load();
  }, [load]);

  const handleDelete = (m: ShiftHierarchyMapping) => {
    Alert.alert('Remove this mapping?', `${m.parentShiftName} will no longer manage ${m.childShiftName}'s leave approvals.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setBusyId(m.id);
          try {
            await deleteShiftHierarchyMapping(m.id);
            await load(search || undefined);
          } catch (err: any) {
            Alert.alert('Could not remove', err?.response?.data?.message || 'Please try again.');
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  // Group flat mapping rows by parent for a friendlier "parent -> children" card layout.
  const grouped = mappings.reduce<Record<number, { parentShiftName: string; children: ShiftHierarchyMapping[] }>>((acc, m) => {
    if (!acc[m.parentShiftId]) acc[m.parentShiftId] = { parentShiftName: m.parentShiftName, children: [] };
    acc[m.parentShiftId].children.push(m);
    return acc;
  }, {});

  return (
    <View style={styles.screen}>
      <View style={styles.topRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search parent or child shift..."
          placeholderTextColor={A.muted}
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={() => load(search || undefined)}
          returnKeyType="search"
        />
        <Pressable style={styles.addBtn} onPress={() => setFormTarget({})}>
          <Text style={styles.addBtnText}>+ Add</Text>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={A.primary} style={styles.loader} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.countText}>{total} mapping{total === 1 ? '' : 's'}</Text>
          {Object.keys(grouped).length === 0 ? (
            <Text style={styles.emptyText}>No mappings found. Tap Add to create the first one.</Text>
          ) : (
            Object.entries(grouped).map(([parentId, group]) => (
              <View key={parentId} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.parentName}>{group.parentShiftName}</Text>
                  <Pressable style={styles.manageBtn} onPress={() => setFormTarget({ parentShiftId: Number(parentId) })}>
                    <Text style={styles.manageBtnText}>Manage Children</Text>
                  </Pressable>
                </View>
                {group.children.map((c) => (
                  <View key={c.id} style={styles.childRow}>
                    <Text style={styles.childName}>→ {c.childShiftName}</Text>
                    <Pressable onPress={() => handleDelete(c)} disabled={busyId === c.id}>
                      {busyId === c.id ? <ActivityIndicator size="small" color="#b91c1c" /> : <Text style={styles.removeText}>Remove</Text>}
                    </Pressable>
                  </View>
                ))}
              </View>
            ))
          )}
        </ScrollView>
      )}

      {formTarget && (
        <MappingFormModal
          parentShiftId={formTarget.parentShiftId}
          shiftOptions={shiftOptions}
          onClose={() => setFormTarget(null)}
          onSaved={() => {
            setFormTarget(null);
            load(search || undefined);
          }}
        />
      )}
    </View>
  );
}

function MappingFormModal({
  parentShiftId,
  shiftOptions,
  onClose,
  onSaved,
}: {
  parentShiftId?: number;
  shiftOptions: ShiftDropdownOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const insets = useSafeAreaInsets();
  const isEdit = !!parentShiftId;
  const [selectedParent, setSelectedParent] = useState<number | ''>(parentShiftId || '');
  const [selectedChildren, setSelectedChildren] = useState<Set<number>>(new Set());
  const [loadingChildren, setLoadingChildren] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isEdit && parentShiftId) {
      getChildIdsForParent(parentShiftId)
        .then((res) => setSelectedChildren(new Set(res.data.childIds)))
        .catch(() => {})
        .finally(() => setLoadingChildren(false));
    }
  }, [isEdit, parentShiftId]);

  const toggleChild = (id: number) => {
    setSelectedChildren((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const save = async () => {
    if (!selectedParent) return Alert.alert('Please select a Parent Shift.');
    if (selectedChildren.size === 0) return Alert.alert('Please select at least one Child Shift.');

    setSaving(true);
    try {
      const res = await saveShiftHierarchyMapping({
        parentShiftId: Number(selectedParent),
        childShiftIds: [...selectedChildren],
        isEditMode: isEdit,
      });
      Alert.alert(res.data.errors?.length ? 'Saved with warnings' : 'Saved', res.data.message + (res.data.errors?.length ? ` (${res.data.errors.join('; ')})` : ''));
      onSaved();
    } catch (err: any) {
      const errors: string[] | undefined = err?.response?.data?.errors;
      Alert.alert('Could not save', errors?.join(' ') || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const childCandidates = shiftOptions.filter((s) => s.shiftId !== selectedParent);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={[styles.modalBox, { paddingBottom: spacing(2.5) + insets.bottom }]} onPress={(e) => e.stopPropagation()}>
          <ScrollView>
            <Text style={styles.modalTitle}>{isEdit ? 'Manage Children' : 'Add Mapping'}</Text>

            <Text style={styles.label}>Parent Shift *</Text>
            <View style={styles.pickerWrap}>
              <Picker enabled={!isEdit} selectedValue={selectedParent} onValueChange={(v) => setSelectedParent(v as number | '')}>
                <Picker.Item label="-- Select Parent Shift --" value="" />
                {shiftOptions.map((s) => (
                  <Picker.Item key={s.shiftId} label={s.shiftName} value={s.shiftId} />
                ))}
              </Picker>
            </View>

            <Text style={styles.label}>Child Shifts * ({selectedChildren.size} selected)</Text>
            {loadingChildren ? (
              <ActivityIndicator size="small" color={A.primary} />
            ) : (
              <View style={styles.checklistBox}>
                {childCandidates.map((s) => {
                  const checked = selectedChildren.has(s.shiftId);
                  return (
                    <Pressable key={s.shiftId} style={styles.checkRow} onPress={() => toggleChild(s.shiftId)}>
                      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>{checked ? <Text style={styles.checkmark}>✓</Text> : null}</View>
                      <Text style={styles.checkLabel}>{s.shiftName}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}

            <View style={styles.modalActions}>
              <Button title="Cancel" variant="outline" onPress={onClose} style={{ flex: 1 }} />
              <Button title="Save" onPress={save} loading={saving} style={{ flex: 1 }} />
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
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
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  parentName: { fontSize: 14, fontWeight: '800', color: A.ink },
  manageBtn: { backgroundColor: A.primary + '1a', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  manageBtnText: { fontSize: 11, fontWeight: '700', color: A.primary },
  childRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6, borderTopWidth: 1, borderTopColor: A.border },
  childName: { fontSize: 13, color: A.ink },
  removeText: { fontSize: 12, fontWeight: '700', color: '#b91c1c' },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,13,35,0.5)', justifyContent: 'flex-end' },
  modalBox: { maxHeight: '92%', backgroundColor: A.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: spacing(2.5) },
  modalTitle: { fontSize: 16, fontWeight: '800', color: A.ink, marginBottom: spacing(1.5) },
  label: { fontSize: 13, color: A.muted, marginBottom: 6, fontWeight: '500' },
  pickerWrap: { borderWidth: 1, borderColor: A.border, borderRadius: radius.sm, marginBottom: 16, backgroundColor: A.surface },
  checklistBox: { borderWidth: 1, borderColor: A.border, borderRadius: radius.sm, marginBottom: 16, maxHeight: 260 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: A.border },
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: A.border, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: A.primary, borderColor: A.primary },
  checkmark: { color: '#fff', fontSize: 12, fontWeight: '800' },
  checkLabel: { fontSize: 13, color: A.ink, flex: 1 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: spacing(1), marginBottom: spacing(2) },
});
