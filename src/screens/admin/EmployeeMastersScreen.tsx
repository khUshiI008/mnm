import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Button from '../../components/Button';
import TextField from '../../components/TextField';
import { colors, radius, shadow, spacing } from '../../theme';
import {
  createMasterItem,
  deleteMasterItem,
  getMasterItems,
  getMasterTabs,
  MasterItem,
  MasterTab,
  updateMasterItem,
} from '../../api/adminEmployeeMastersApi';

const A = colors.admin;

export default function EmployeeMastersScreen() {
  const [tabs, setTabs] = useState<MasterTab[]>([]);
  const [activeType, setActiveType] = useState('Department');
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<MasterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [formTarget, setFormTarget] = useState<{ item?: MasterItem } | null>(null);

  useEffect(() => {
    getMasterTabs().then((res) => setTabs(res.data.tabs)).catch(() => {});
  }, []);

  const load = useCallback(async (type: string, term?: string) => {
    setLoading(true);
    try {
      const res = await getMasterItems(type, term);
      setItems(res.data.items);
    } catch {
      Alert.alert('Could not load records');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setSearch('');
    load(activeType);
  }, [activeType, load]);

  const activeTab = tabs.find((t) => t.masterType === activeType);
  const label = activeTab?.label || activeType;

  const handleDelete = (item: MasterItem) => {
    Alert.alert(`Archive this ${label.toLowerCase()}?`, `${item.name} will be archived and hidden from active lists.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Archive',
        style: 'destructive',
        onPress: async () => {
          setBusyId(item.lookupId);
          try {
            await deleteMasterItem(item.lookupId);
            await load(activeType, search || undefined);
          } catch (err: any) {
            Alert.alert('Could not archive', err?.response?.data?.message || 'Please try again.');
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.screen}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll} contentContainerStyle={styles.tabRow}>
        {tabs.map((t) => (
          <Pressable key={t.masterType} style={[styles.tabChip, activeType === t.masterType && styles.tabChipActive]} onPress={() => setActiveType(t.masterType)}>
            <Text style={[styles.tabChipText, activeType === t.masterType && styles.tabChipTextActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {activeTab?.description ? <Text style={styles.tabDescription}>{activeTab.description}</Text> : null}

      <View style={styles.topRow}>
        <TextInput
          style={styles.searchInput}
          placeholder={`Search ${label.toLowerCase()}...`}
          placeholderTextColor={A.muted}
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={() => load(activeType, search || undefined)}
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
          <Text style={styles.countText}>{items.length} records</Text>
          {items.length === 0 ? (
            <Text style={styles.emptyText}>No {label.toLowerCase()} records found. Tap Add to create the first one.</Text>
          ) : (
            items.map((item) => (
              <View key={item.lookupId} style={styles.card}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.name}</Text>
                  {item.description ? <Text style={styles.sub}>{item.description}</Text> : null}
                </View>
                <View style={styles.actionsRow}>
                  <Pressable style={[styles.actionBtn, styles.editBtn]} onPress={() => setFormTarget({ item })}>
                    <Text style={styles.editText}>Edit</Text>
                  </Pressable>
                  <Pressable style={[styles.actionBtn, styles.deleteBtn]} onPress={() => handleDelete(item)} disabled={busyId === item.lookupId}>
                    {busyId === item.lookupId ? <ActivityIndicator size="small" color="#b91c1c" /> : <Text style={styles.deleteText}>Archive</Text>}
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {formTarget && (
        <ItemFormModal
          item={formTarget.item}
          masterType={activeType}
          label={label}
          onClose={() => setFormTarget(null)}
          onSaved={() => {
            setFormTarget(null);
            load(activeType, search || undefined);
          }}
        />
      )}
    </View>
  );
}

function ItemFormModal({
  item,
  masterType,
  label,
  onClose,
  onSaved,
}: {
  item?: MasterItem;
  masterType: string;
  label: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!item;
  const [name, setName] = useState(item?.name || '');
  const [description, setDescription] = useState(item?.description || '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      if (isEdit) await updateMasterItem(item!.lookupId, { name, description });
      else await createMasterItem({ masterType, name, description });
      Alert.alert('Saved', `${label} ${isEdit ? 'updated' : 'created'} successfully.`);
      onSaved();
    } catch (err: any) {
      const errors: string[] | undefined = err?.response?.data?.errors;
      Alert.alert('Could not save', errors?.join(' ') || err?.response?.data?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalBox} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.modalTitle}>{isEdit ? `Edit ${label}` : `Add ${label}`}</Text>
          <TextField label={`${label} Name *`} value={name} onChangeText={setName} />
          <TextField label="Description" value={description} onChangeText={setDescription} multiline numberOfLines={3} />
          <View style={styles.modalActions}>
            <Button title="Cancel" variant="outline" onPress={onClose} style={{ flex: 1 }} />
            <Button title={isEdit ? 'Save Changes' : 'Create'} onPress={save} loading={saving} style={{ flex: 1 }} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: A.bg },
  loader: { marginTop: spacing(4) },
  content: { padding: spacing(2) },

  tabScroll: { flexGrow: 0, flexShrink: 0 },
  tabRow: { paddingHorizontal: spacing(2), paddingTop: spacing(2), gap: 8, alignItems: 'center' },
  tabChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: A.surface, borderWidth: 1, borderColor: A.border, marginRight: 8 },
  tabChipActive: { backgroundColor: A.primary, borderColor: A.primary },
  tabChipText: { fontSize: 12, fontWeight: '700', color: A.muted },
  tabChipTextActive: { color: '#fff' },
  tabDescription: { fontSize: 12, color: A.muted, paddingHorizontal: spacing(2), marginTop: 8 },

  topRow: { flexDirection: 'row', gap: 8, padding: spacing(2), paddingBottom: 0 },
  searchInput: { flex: 1, height: 42, borderWidth: 1, borderColor: A.border, borderRadius: radius.sm, backgroundColor: A.surface, paddingHorizontal: 12, color: A.ink, fontSize: 13 },
  addBtn: { height: 42, paddingHorizontal: 16, borderRadius: radius.sm, backgroundColor: A.primary, alignItems: 'center', justifyContent: 'center' },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  countText: { color: A.muted, fontSize: 12, marginBottom: spacing(1.5) },
  emptyText: { color: A.muted, fontSize: 13, textAlign: 'center', marginTop: spacing(4) },

  card: { backgroundColor: A.surface, borderRadius: radius.md, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 10, ...shadow.card },
  name: { fontSize: 14, fontWeight: '800', color: A.ink },
  sub: { fontSize: 12, color: A.muted, marginTop: 2 },

  actionsRow: { flexDirection: 'row', gap: 8 },
  actionBtn: { height: 34, paddingHorizontal: 12, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  editBtn: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: A.border },
  editText: { color: A.ink, fontWeight: '700', fontSize: 12 },
  deleteBtn: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#fca5a5' },
  deleteText: { color: '#b91c1c', fontWeight: '700', fontSize: 12 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,13,35,0.5)', alignItems: 'center', justifyContent: 'center', padding: spacing(3) },
  modalBox: { width: '100%', backgroundColor: A.surface, borderRadius: radius.md, padding: spacing(2.5) },
  modalTitle: { fontSize: 16, fontWeight: '800', color: A.ink, marginBottom: spacing(1.5) },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: spacing(1) },
});
