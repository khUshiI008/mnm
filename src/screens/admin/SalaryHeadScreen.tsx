import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Picker } from '../../components/AppPicker';
import Button from '../../components/Button';
import TextField from '../../components/TextField';
import SearchableSelect from '../../components/common/SearchableSelect';
import { colors, radius, shadow, spacing } from '../../theme';
import {
  createSalaryHead,
  deleteSalaryHead,
  getAssignableHeadOptions,
  getSalaryHeads,
  getStructure,
  getStructureEmployees,
  removeAssignment,
  saveAssignment,
  SalaryHeadOption,
  SalaryHeadPayload,
  SalaryHeadRow,
  StructureComponent,
  StructureEmployee,
  StructureResponse,
  updateSalaryHead,
} from '../../api/adminSalaryHeadApi';

const A = colors.admin;

export default function SalaryHeadScreen() {
  const [tab, setTab] = useState<'heads' | 'structure'>('heads');

  return (
    <View style={styles.screen}>
      <View style={styles.tabRow}>
        <Pressable style={[styles.tabBtn, tab === 'heads' && styles.tabBtnActive]} onPress={() => setTab('heads')}>
          <Text style={[styles.tabBtnText, tab === 'heads' && styles.tabBtnTextActive]}>Head Master</Text>
        </Pressable>
        <Pressable style={[styles.tabBtn, tab === 'structure' && styles.tabBtnActive]} onPress={() => setTab('structure')}>
          <Text style={[styles.tabBtnText, tab === 'structure' && styles.tabBtnTextActive]}>Employee Structure</Text>
        </Pressable>
      </View>

      {tab === 'heads' ? <HeadMasterTab /> : <StructureTab />}
    </View>
  );
}

function HeadMasterTab() {
  const [heads, setHeads] = useState<SalaryHeadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [formTarget, setFormTarget] = useState<{ row?: SalaryHeadRow } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getSalaryHeads();
      setHeads(res.data.heads);
    } catch {
      Alert.alert('Could not load salary heads');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = (row: SalaryHeadRow) => {
    Alert.alert('Delete this head?', `${row.headName} will be archived.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setBusyId(row.salaryHeadId);
          try {
            await deleteSalaryHead(row.salaryHeadId);
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
    <View style={{ flex: 1 }}>
      <View style={styles.topRow}>
        <Text style={styles.countText}>{heads.length} heads</Text>
        <Pressable style={styles.addBtn} onPress={() => setFormTarget({})}>
          <Text style={styles.addBtnText}>+ Add</Text>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={A.primary} style={styles.loader} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {heads.length === 0 ? (
            <Text style={styles.emptyText}>No salary heads found. Tap Add to create the first one.</Text>
          ) : (
            heads.map((h) => (
              <View key={h.salaryHeadId} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{h.headName}</Text>
                    <Text style={styles.sub}>{h.valueDisplay} · Order {h.displayOrder}</Text>
                  </View>
                  <View style={[styles.typeBadge, h.headType === 'Deduction' && styles.typeBadgeDeduction]}>
                    <Text style={[styles.typeBadgeText, h.headType === 'Deduction' && styles.typeBadgeTextDeduction]}>{h.headType}</Text>
                  </View>
                </View>
                <View style={styles.actionsRow}>
                  <Pressable style={[styles.actionBtn, styles.editBtn]} onPress={() => setFormTarget({ row: h })}>
                    <Text style={styles.editText}>Edit</Text>
                  </Pressable>
                  <Pressable style={[styles.actionBtn, styles.deleteBtn]} onPress={() => handleDelete(h)} disabled={busyId === h.salaryHeadId}>
                    {busyId === h.salaryHeadId ? <ActivityIndicator size="small" color="#b91c1c" /> : <Text style={styles.deleteText}>Delete</Text>}
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {formTarget && (
        <HeadFormModal
          row={formTarget.row}
          onClose={() => setFormTarget(null)}
          onSaved={() => {
            setFormTarget(null);
            load();
          }}
        />
      )}
    </View>
  );
}

function HeadFormModal({ row, onClose, onSaved }: { row?: SalaryHeadRow; onClose: () => void; onSaved: () => void }) {
  const insets = useSafeAreaInsets();
  const isEdit = !!row;
  const [headName, setHeadName] = useState(row?.headName || '');
  const [headType, setHeadType] = useState(row?.headType || 'Earning');
  const [calcType, setCalcType] = useState(row?.calcType || 'PercentOfBasic');
  const [value, setValue] = useState(row ? String(row.value) : '');
  const [displayOrder, setDisplayOrder] = useState(row ? String(row.displayOrder) : '99');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const payload: SalaryHeadPayload = { headName, headType, calcType, value: Number(value), displayOrder: Number(displayOrder) };
    setSaving(true);
    try {
      if (isEdit) await updateSalaryHead(row!.salaryHeadId, payload);
      else await createSalaryHead(payload);
      Alert.alert('Saved', `Salary head ${isEdit ? 'updated' : 'created'} successfully.`);
      onSaved();
    } catch (err: any) {
      const errors: string[] | undefined = err?.response?.data?.errors;
      Alert.alert('Could not save', errors?.join(' ') || err?.response?.data?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={[styles.modalBox, { paddingBottom: spacing(2.5) + insets.bottom }]} onPress={(e) => e.stopPropagation()}>
          <ScrollView>
            <Text style={styles.modalTitle}>{isEdit ? 'Edit Salary Head' : 'Add Salary Head'}</Text>
            <TextField label="Head Name *" value={headName} onChangeText={setHeadName} />

            <Text style={styles.label}>Head Type *</Text>
            <View style={styles.pickerWrap}>
              <Picker selectedValue={headType} onValueChange={setHeadType}>
                <Picker.Item label="Earning" value="Earning" />
                <Picker.Item label="Deduction" value="Deduction" />
              </Picker>
            </View>

            <Text style={styles.label}>Calculation Type *</Text>
            <View style={styles.pickerWrap}>
              <Picker selectedValue={calcType} onValueChange={setCalcType}>
                <Picker.Item label="% of Basic Salary" value="PercentOfBasic" />
                <Picker.Item label="Fixed Amount (Rs.)" value="FixedAmount" />
              </Picker>
            </View>

            <TextField label={calcType === 'PercentOfBasic' ? 'Percent (%) *' : 'Amount (Rs.) *'} value={value} onChangeText={setValue} keyboardType="decimal-pad" />
            <TextField label="Display Order *" value={displayOrder} onChangeText={setDisplayOrder} keyboardType="number-pad" />

            <View style={styles.modalActions}>
              <Button title="Cancel" variant="outline" onPress={onClose} style={{ flex: 1 }} />
              <Button title={isEdit ? 'Save Changes' : 'Create'} onPress={save} loading={saving} style={{ flex: 1 }} />
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function StructureTab() {
  const [employees, setEmployees] = useState<StructureEmployee[]>([]);
  const [employeeId, setEmployeeId] = useState<number | ''>('');
  const [structure, setStructure] = useState<StructureResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [assignTarget, setAssignTarget] = useState<{ component?: StructureComponent } | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    getStructureEmployees().then((res) => setEmployees(res.data.employees)).catch(() => {});
  }, []);

  const load = useCallback(async (empId: number) => {
    setLoading(true);
    try {
      const res = await getStructure(empId);
      setStructure(res.data);
    } catch {
      Alert.alert('Could not load salary structure');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (employeeId) load(Number(employeeId));
    else setStructure(null);
  }, [employeeId, load]);

  const handleRemove = (component: StructureComponent) => {
    Alert.alert('Remove this component?', `${component.headName} will be removed from the employee's structure.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setBusyId(component.employeeSalaryHeadId);
          try {
            await removeAssignment(component.employeeSalaryHeadId);
            await load(Number(employeeId));
          } catch (err: any) {
            Alert.alert('Could not remove', err?.response?.data?.message || 'Please try again.');
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.topRow}>
        <SearchableSelect
          style={{ flex: 1, marginBottom: 0 }}
          selectedValue={employeeId}
          onValueChange={(v) => setEmployeeId(v as number | '')}
          items={employees.map((e) => ({ label: e.label, value: e.employeeId }))}
          placeholder="-- Select Employee --"
          searchPlaceholder="Search name or code"
          title="Select Employee"
        />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={A.primary} style={styles.loader} />
      ) : !structure ? (
        <Text style={styles.emptyText}>Select an employee to view their salary structure.</Text>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.summaryCard}>
            <Text style={styles.name}>{structure.employeeName} <Text style={styles.sub}>· {structure.employeeCode}</Text></Text>
            <Text style={styles.sub}>{structure.salaryMonthNote}</Text>
            <View style={styles.kpiRow}>
              <View style={styles.kpiBox}>
                <Text style={styles.kpiVal}>₹{structure.basicSalaryDisplay}</Text>
                <Text style={styles.kpiLbl}>Basic</Text>
              </View>
              <View style={styles.kpiBox}>
                <Text style={[styles.kpiVal, { color: '#15803d' }]}>₹{structure.grossDisplay}</Text>
                <Text style={styles.kpiLbl}>Gross</Text>
              </View>
              <View style={styles.kpiBox}>
                <Text style={[styles.kpiVal, { color: '#dc2626' }]}>₹{structure.deductionsDisplay}</Text>
                <Text style={styles.kpiLbl}>Deductions</Text>
              </View>
              <View style={styles.kpiBox}>
                <Text style={styles.kpiVal}>₹{structure.netDisplay}</Text>
                <Text style={styles.kpiLbl}>Net</Text>
              </View>
            </View>
          </View>

          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Earnings</Text>
          </View>
          {structure.earnings.length === 0 ? (
            <Text style={styles.emptySmall}>No earnings assigned.</Text>
          ) : (
            structure.earnings.map((c) => <ComponentRow key={c.employeeSalaryHeadId} c={c} busy={busyId === c.employeeSalaryHeadId} onEdit={() => setAssignTarget({ component: c })} onRemove={() => handleRemove(c)} />)
          )}

          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Deductions</Text>
          </View>
          {structure.deductions.length === 0 ? (
            <Text style={styles.emptySmall}>No deductions assigned.</Text>
          ) : (
            structure.deductions.map((c) => <ComponentRow key={c.employeeSalaryHeadId} c={c} busy={busyId === c.employeeSalaryHeadId} onEdit={() => setAssignTarget({ component: c })} onRemove={() => handleRemove(c)} />)
          )}

          <Pressable style={styles.assignBtn} onPress={() => setAssignTarget({})}>
            <Text style={styles.assignBtnText}>+ Add Salary Component</Text>
          </Pressable>
        </ScrollView>
      )}

      {assignTarget && employeeId && (
        <AssignHeadModal
          employeeId={Number(employeeId)}
          component={assignTarget.component}
          onClose={() => setAssignTarget(null)}
          onSaved={() => {
            setAssignTarget(null);
            load(Number(employeeId));
          }}
        />
      )}
    </View>
  );
}

function ComponentRow({ c, busy, onEdit, onRemove }: { c: StructureComponent; busy: boolean; onEdit: () => void; onRemove: () => void }) {
  return (
    <View style={styles.compRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.compName}>{c.headName}</Text>
        <Text style={styles.compDesc}>{c.calcDesc}</Text>
      </View>
      <Text style={styles.compAmt}>₹{c.amountDisplay}</Text>
      <View style={styles.compActions}>
        <Pressable onPress={onEdit}>
          <Text style={styles.compEdit}>Edit</Text>
        </Pressable>
        <Pressable onPress={onRemove} disabled={busy}>
          {busy ? <ActivityIndicator size="small" color="#b91c1c" /> : <Text style={styles.compRemove}>Remove</Text>}
        </Pressable>
      </View>
    </View>
  );
}

function AssignHeadModal({
  employeeId,
  component,
  onClose,
  onSaved,
}: {
  employeeId: number;
  component?: StructureComponent;
  onClose: () => void;
  onSaved: () => void;
}) {
  const insets = useSafeAreaInsets();
  const isEdit = !!component;
  const [options, setOptions] = useState<SalaryHeadOption[]>([]);
  const [salaryHeadId, setSalaryHeadId] = useState<number | ''>(component?.salaryHeadId || '');
  const [calcType, setCalcType] = useState(component?.effCalcType || '');
  const [value, setValue] = useState(component ? String(component.effValue) : '');
  const [defaultLabel, setDefaultLabel] = useState('Select a head to see its default.');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getAssignableHeadOptions().then((res) => {
      setOptions(res.data.heads);
      if (component) {
        const opt = res.data.heads.find((h) => h.salaryHeadId === component.salaryHeadId);
        if (opt) setDefaultLabel(`Default for ${opt.headName}: ${opt.defaultDisplay}`);
      }
    }).catch(() => {});
  }, [component]);

  const onSelectHead = (id: number | '') => {
    setSalaryHeadId(id);
    const opt = options.find((h) => h.salaryHeadId === id);
    if (opt) {
      setCalcType(opt.calcType);
      setValue(String(opt.value));
      setDefaultLabel(`Default for ${opt.headName}: ${opt.defaultDisplay}`);
    }
  };

  const save = async () => {
    if (!salaryHeadId) return Alert.alert('Please select a salary head.');
    setSaving(true);
    try {
      await saveAssignment({
        employeeSalaryHeadId: component?.employeeSalaryHeadId,
        employeeId,
        salaryHeadId: Number(salaryHeadId),
        calcType,
        value,
      });
      Alert.alert('Saved', 'Salary component saved.');
      onSaved();
    } catch (err: any) {
      const errors: string[] | undefined = err?.response?.data?.errors;
      Alert.alert('Could not save', errors?.join(' ') || err?.response?.data?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={[styles.modalBox, { paddingBottom: spacing(2.5) + insets.bottom }]} onPress={(e) => e.stopPropagation()}>
          <ScrollView>
            <Text style={styles.modalTitle}>{isEdit ? `Edit Component — ${component?.headName}` : 'Add Salary Component'}</Text>

            {!isEdit && (
              <>
                <Text style={styles.label}>Salary Head *</Text>
                <SearchableSelect
                  selectedValue={salaryHeadId}
                  onValueChange={(v) => onSelectHead(v as number | '')}
                  items={options.map((h) => ({ label: h.label, value: h.salaryHeadId }))}
                  placeholder="-- Select Head --"
                  searchPlaceholder="Search salary head"
                  title="Select Salary Head"
                />
              </>
            )}

            <Text style={styles.defaultNote}>{defaultLabel}</Text>

            <Text style={styles.label}>Calculation Type (override)</Text>
            <View style={styles.pickerWrap}>
              <Picker selectedValue={calcType} onValueChange={setCalcType}>
                <Picker.Item label="PercentOfBasic" value="PercentOfBasic" />
                <Picker.Item label="FixedAmount" value="FixedAmount" />
              </Picker>
            </View>

            <TextField label="Value (override)" value={value} onChangeText={setValue} keyboardType="decimal-pad" />

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

  tabRow: { flexDirection: 'row', gap: 8, padding: spacing(2), paddingBottom: 0 },
  tabBtn: { flex: 1, height: 40, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: A.surface, borderWidth: 1, borderColor: A.border },
  tabBtnActive: { backgroundColor: A.primary, borderColor: A.primary },
  tabBtnText: { fontSize: 13, fontWeight: '700', color: A.muted },
  tabBtnTextActive: { color: '#fff' },

  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: spacing(2), paddingBottom: 0 },
  countText: { color: A.muted, fontSize: 12, flex: 1 },
  addBtn: { height: 42, paddingHorizontal: 16, borderRadius: radius.sm, backgroundColor: A.primary, alignItems: 'center', justifyContent: 'center' },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  emptyText: { color: A.muted, fontSize: 13, textAlign: 'center', marginTop: spacing(4), paddingHorizontal: spacing(2) },
  emptySmall: { color: A.muted, fontSize: 12, marginBottom: 10 },

  card: { backgroundColor: A.surface, borderRadius: radius.md, padding: 14, marginBottom: 12, ...shadow.card },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 10 },
  name: { fontSize: 14, fontWeight: '800', color: A.ink },
  sub: { fontSize: 12, color: A.muted, marginTop: 2 },
  typeBadge: { backgroundColor: '#dcfce7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  typeBadgeText: { fontSize: 10, fontWeight: '700', color: '#15803d' },
  typeBadgeDeduction: { backgroundColor: '#fee2e2' },
  typeBadgeTextDeduction: { color: '#b91c1c' },

  actionsRow: { flexDirection: 'row', gap: 8 },
  actionBtn: { flexGrow: 1, height: 36, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  editBtn: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: A.border },
  editText: { color: A.ink, fontWeight: '700', fontSize: 12 },
  deleteBtn: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#fca5a5' },
  deleteText: { color: '#b91c1c', fontWeight: '700', fontSize: 12 },

  summaryCard: { backgroundColor: A.surface, borderRadius: radius.md, padding: 16, marginBottom: 16, ...shadow.card },
  kpiRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  kpiBox: { flex: 1, alignItems: 'center' },
  kpiVal: { fontSize: 14, fontWeight: '800', color: A.ink },
  kpiLbl: { fontSize: 9, color: A.muted, marginTop: 2, fontWeight: '600' },

  sectionHeaderRow: { marginTop: 6, marginBottom: 8 },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: A.ink },

  compRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: A.surface, borderRadius: radius.sm, padding: 10, marginBottom: 8, gap: 10, ...shadow.card },
  compName: { fontSize: 13, fontWeight: '700', color: A.ink },
  compDesc: { fontSize: 11, color: A.muted, marginTop: 2 },
  compAmt: { fontSize: 13, fontWeight: '800', color: A.ink },
  compActions: { alignItems: 'flex-end', gap: 6 },
  compEdit: { fontSize: 11, fontWeight: '700', color: A.primary },
  compRemove: { fontSize: 11, fontWeight: '700', color: '#b91c1c' },

  assignBtn: { height: 42, borderRadius: radius.sm, borderWidth: 1.5, borderColor: A.primary, alignItems: 'center', justifyContent: 'center', marginTop: 8, marginBottom: 20 },
  assignBtnText: { color: A.primary, fontWeight: '700', fontSize: 13 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,13,35,0.5)', justifyContent: 'flex-end' },
  modalBox: { maxHeight: '92%', backgroundColor: A.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: spacing(2.5) },
  modalTitle: { fontSize: 16, fontWeight: '800', color: A.ink, marginBottom: spacing(1.5) },
  label: { fontSize: 13, color: A.muted, marginBottom: 6, fontWeight: '500' },
  defaultNote: { fontSize: 11, color: A.muted, marginBottom: 12, fontStyle: 'italic' },
  pickerWrap: { borderWidth: 1, borderColor: A.border, borderRadius: radius.sm, marginBottom: 16, backgroundColor: A.surface },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: spacing(1), marginBottom: spacing(2) },
});
