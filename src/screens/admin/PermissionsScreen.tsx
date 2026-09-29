import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Icon from '../../components/Icon';
import Card from '../../components/Card';
import Button from '../../components/Button';
import { colors, radius, shadow, spacing } from '../../theme';
import { EmployeeListItem, getEmployees } from '../../api/employeeApi';
import { PermissionGrant } from '../../api/authApi';
import { getPermissionModules, getPermissionsForEmployee, PermissionModule, setPermissionsForEmployee } from '../../api/permissionsApi';

const A = colors.admin;

type SelectedEmployee = { employeeId: number; employeeName: string; code: string };

export default function PermissionsScreen() {
  const [modules, setModules] = useState<PermissionModule[]>([]);
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<EmployeeListItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<SelectedEmployee | null>(null);
  const [grants, setGrants] = useState<PermissionGrant[]>([]);
  const [loadingGrants, setLoadingGrants] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getPermissionModules()
      .then((res) => setModules(res.data.modules))
      .catch(() => Alert.alert('Could not load permission modules'));
  }, []);

  const runSearch = useCallback(async (s: string) => {
    setSearching(true);
    try {
      const res = await getEmployees({ page: 0, pageSize: 25, search: s || undefined });
      setRows(res.data.employees);
    } catch {
      Alert.alert('Could not search employees');
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    runSearch('');
  }, [runSearch]);

  const pickEmployee = async (row: EmployeeListItem) => {
    setSelected({ employeeId: row.employeeId, employeeName: row.employeeName, code: row.code });
    setLoadingGrants(true);
    try {
      const res = await getPermissionsForEmployee(row.employeeId);
      setGrants(res.data.grants);
    } catch {
      Alert.alert('Could not load current permissions');
      setGrants([]);
    } finally {
      setLoadingGrants(false);
    }
  };

  const isActionChecked = (moduleKey: string, actionKey: string) =>
    grants.some((g) => g.moduleKey === moduleKey && g.actionKey === actionKey);

  const toggleAction = (moduleKey: string, actionKey: string, fieldLevel?: boolean) => {
    setGrants((prev) => {
      if (prev.some((g) => g.moduleKey === moduleKey && g.actionKey === actionKey)) {
        return prev.filter((g) => !(g.moduleKey === moduleKey && g.actionKey === actionKey));
      }
      return [...prev, { moduleKey, actionKey, allowedFields: fieldLevel ? [] : null }];
    });
  };

  const isFieldChecked = (moduleKey: string, actionKey: string, fieldKey: string) => {
    const grant = grants.find((g) => g.moduleKey === moduleKey && g.actionKey === actionKey);
    return !!grant?.allowedFields?.includes(fieldKey);
  };

  const toggleField = (moduleKey: string, actionKey: string, fieldKey: string) => {
    setGrants((prev) =>
      prev.map((g) => {
        if (g.moduleKey !== moduleKey || g.actionKey !== actionKey) return g;
        const current = g.allowedFields ?? [];
        const allowedFields = current.includes(fieldKey) ? current.filter((f) => f !== fieldKey) : [...current, fieldKey];
        return { ...g, allowedFields };
      })
    );
  };

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await setPermissionsForEmployee(selected.employeeId, grants);
      Alert.alert('Saved', `Permissions updated for ${selected.employeeName}.`);
    } catch (err: any) {
      Alert.alert('Could not save', err?.response?.data?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!selected) {
    return (
      <View style={styles.screen}>
        <View style={styles.searchRow}>
          <Icon name="search" size={16} color={A.muted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search employee to grant permissions to..."
            placeholderTextColor={A.muted}
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={() => runSearch(search)}
            returnKeyType="search"
          />
        </View>
        {searching ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={A.primary} />
          </View>
        ) : (
          <FlatList
            data={rows}
            keyExtractor={(r) => String(r.employeeId)}
            contentContainerStyle={styles.content}
            ListEmptyComponent={<Text style={styles.emptyText}>No employees found.</Text>}
            renderItem={({ item }) => (
              <Pressable style={styles.pickCard} onPress={() => pickEmployee(item)}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{item.employeeName.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.employeeName}</Text>
                  <Text style={styles.sub}>
                    {item.code} · {item.departmentName || 'No dept'}
                  </Text>
                </View>
                <Icon name="chevronRight" size={16} color={A.muted} />
              </Pressable>
            )}
          />
        )}
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable style={styles.changeEmployee} onPress={() => setSelected(null)}>
          <Icon name="chevronLeft" size={16} color={A.primary} />
          <Text style={styles.changeEmployeeText}>Change employee</Text>
        </Pressable>
        <Text style={styles.selectedName}>{selected.employeeName}</Text>
        <Text style={styles.selectedSub}>{selected.code}</Text>

        {loadingGrants ? (
          <ActivityIndicator size="large" color={A.primary} style={{ marginTop: spacing(3) }} />
        ) : (
          modules.map((mod) => (
            <Card key={mod.moduleKey} style={styles.moduleCard}>
              <Text style={styles.moduleLabel}>{mod.label}</Text>
              <View style={styles.actionsRow}>
                {mod.actions.map((action) => {
                  const checked = isActionChecked(mod.moduleKey, action.key);
                  return (
                    <Pressable
                      key={action.key}
                      style={[styles.actionChip, checked && styles.actionChipActive]}
                      onPress={() => toggleAction(mod.moduleKey, action.key, action.fieldLevel)}
                    >
                      {checked && <Icon name="check" size={12} color="#fff" />}
                      <Text style={[styles.actionChipText, checked && styles.actionChipTextActive]}>{action.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {mod.editableFields &&
                mod.actions
                  .filter((a) => a.fieldLevel && isActionChecked(mod.moduleKey, a.key))
                  .map((a) => (
                    <View key={a.key} style={styles.fieldsBox}>
                      <Text style={styles.fieldsTitle}>Editable fields for {a.label}</Text>
                      <View style={styles.fieldsGrid}>
                        {mod.editableFields!.map((f) => {
                          const checked = isFieldChecked(mod.moduleKey, a.key, f.key);
                          return (
                            <Pressable key={f.key} style={styles.fieldRow} onPress={() => toggleField(mod.moduleKey, a.key, f.key)}>
                              <View style={[styles.checkbox, checked && styles.checkboxActive]}>
                                {checked && <Icon name="check" size={11} color="#fff" />}
                              </View>
                              <Text style={styles.fieldLabel}>{f.label}</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  ))}
            </Card>
          ))
        )}

        <Button title="Save Permissions" onPress={save} loading={saving} style={{ marginTop: spacing(1) }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: A.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing(2), paddingBottom: spacing(5) },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    margin: spacing(2),
    marginBottom: 0,
    backgroundColor: A.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: A.border,
    paddingHorizontal: 12,
    height: 42,
  },
  searchInput: { flex: 1, fontSize: 14, color: A.ink },
  emptyText: { color: A.muted, fontSize: 13, textAlign: 'center', marginTop: spacing(4) },

  pickCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: A.surface, borderRadius: radius.md, padding: 12, marginBottom: 10, ...shadow.card },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: A.primary + '20', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: A.primary, fontWeight: '800', fontSize: 16 },
  name: { fontSize: 14, fontWeight: '800', color: A.ink },
  sub: { fontSize: 12, color: A.muted, marginTop: 2 },

  changeEmployee: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: spacing(1.5) },
  changeEmployeeText: { color: A.primary, fontWeight: '700', fontSize: 13 },
  selectedName: { fontSize: 18, fontWeight: '800', color: A.ink },
  selectedSub: { fontSize: 13, color: A.muted, marginBottom: spacing(2) },

  moduleCard: { marginBottom: spacing(2), borderRadius: radius.md },
  moduleLabel: { fontSize: 15, fontWeight: '800', color: A.ink, marginBottom: spacing(1.5) },
  actionsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: A.border,
    backgroundColor: A.bg,
  },
  actionChipActive: { borderColor: A.primary, backgroundColor: A.primary },
  actionChipText: { fontSize: 13, fontWeight: '700', color: A.muted },
  actionChipTextActive: { color: '#fff' },

  fieldsBox: { marginTop: spacing(2), paddingTop: spacing(1.5), borderTopWidth: 1, borderTopColor: A.border },
  fieldsTitle: { fontSize: 12, fontWeight: '700', color: A.muted, marginBottom: spacing(1), textTransform: 'uppercase' },
  fieldsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  fieldRow: { flexDirection: 'row', alignItems: 'center', gap: 6, width: '47%' },
  checkbox: { width: 18, height: 18, borderRadius: 5, borderWidth: 1.5, borderColor: A.border, alignItems: 'center', justifyContent: 'center' },
  checkboxActive: { backgroundColor: A.primary, borderColor: A.primary },
  fieldLabel: { fontSize: 12, color: A.ink, flexShrink: 1 },
});
