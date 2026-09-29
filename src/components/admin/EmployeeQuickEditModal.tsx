import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import TextField from '../TextField';
import Button from '../Button';
import { colors, radius, spacing } from '../../theme';
import { getLookupOptions, LookupOption, quickEditEmployee, QuickEditPayload, QuickEditResult } from '../../api/employeeApi';

const A = colors.admin;

export type QuickEditTarget = {
  employeeId: number;
  name: string;
  salary: number | null;
  designationLookupId: number | 'unspecified' | null;
  departmentLookupId: number | null;
  employeeTypeLookupId: number | null;
};

/**
 * Salary / Designation / Department / Employee Type fixer — reached from the
 * Total Employees breakdown list (EmployeeBreakdownScreen) for correcting
 * records that were mis-entered or left blank at onboarding. Deliberately
 * just these four fields, not the full Add/Edit Employee form (which
 * requires Code/Name/Mobile/Gender/Org/Location etc.) — same "lightweight,
 * single-purpose, freely reversible" spirit as the existing Change
 * Employment Status modal. Employee Type is included because it's what
 * drives the screen's own Inhouse/Brand Staff tabs — changing it here can
 * move the employee to a different tab once the list reloads.
 */
export default function EmployeeQuickEditModal({
  target,
  onClose,
  onSaved,
}: {
  target: QuickEditTarget | null;
  onClose: () => void;
  onSaved: (result: QuickEditResult) => void;
}) {
  const [departments, setDepartments] = useState<LookupOption[] | null>(null);
  const [designations, setDesignations] = useState<LookupOption[] | null>(null);
  const [employeeTypes, setEmployeeTypes] = useState<LookupOption[] | null>(null);
  const [loadingLookups, setLoadingLookups] = useState(false);

  const [salaryText, setSalaryText] = useState('');
  const [designationLookupId, setDesignationLookupId] = useState<number | null>(null);
  const [departmentLookupId, setDepartmentLookupId] = useState<number | null>(null);
  const [employeeTypeLookupId, setEmployeeTypeLookupId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const visible = !!target;

  useEffect(() => {
    if (!target) return;
    setSalaryText(target.salary != null ? String(target.salary) : '');
    setDesignationLookupId(typeof target.designationLookupId === 'number' ? target.designationLookupId : null);
    setDepartmentLookupId(target.departmentLookupId ?? null);
    setEmployeeTypeLookupId(target.employeeTypeLookupId ?? null);

    if (!departments || !designations || !employeeTypes) {
      setLoadingLookups(true);
      getLookupOptions()
        .then((res) => {
          setDepartments(res.data.departments);
          setDesignations(res.data.designations);
          setEmployeeTypes(res.data.employeeTypes);
        })
        .catch(() => Alert.alert('Could not load Department/Designation/Employee Type options', 'Please try again.'))
        .finally(() => setLoadingLookups(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.employeeId]);

  const handleSave = async () => {
    if (!target) return;
    const salaryTrim = salaryText.trim();
    if (salaryTrim !== '' && !/^\d{0,10}(\.\d{1,2})?$/.test(salaryTrim)) {
      Alert.alert('Invalid salary', 'Enter a valid salary amount.');
      return;
    }

    const payload: QuickEditPayload = {
      salary: salaryTrim === '' ? null : Number(salaryTrim),
      designationLookupId,
      departmentLookupId,
      employeeTypeLookupId,
    };

    setSaving(true);
    try {
      const res = await quickEditEmployee(target.employeeId, payload);
      onSaved(res.data.employee);
    } catch (err: any) {
      Alert.alert('Could not save', err?.response?.data?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.box} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>Edit Employee Details</Text>
          {target ? <Text style={styles.subtitle}>{target.name}</Text> : null}

          {loadingLookups ? (
            <ActivityIndicator size="small" color={A.primary} style={{ marginVertical: spacing(3) }} />
          ) : (
            <ScrollView style={styles.fieldsScroll} showsVerticalScrollIndicator={false}>
              <TextField label="Salary" value={salaryText} onChangeText={setSalaryText} keyboardType="decimal-pad" placeholder="e.g. 25000" />

              <Text style={styles.label}>Designation</Text>
              <View style={styles.pickerWrap}>
                <Picker selectedValue={designationLookupId} onValueChange={(v) => setDesignationLookupId(v == null ? null : Number(v))}>
                  <Picker.Item label="-- Not set --" value={null} />
                  {(designations || []).map((d) => (
                    <Picker.Item key={d.lookupId} label={d.name} value={d.lookupId} />
                  ))}
                </Picker>
              </View>

              <Text style={styles.label}>Department</Text>
              <View style={styles.pickerWrap}>
                <Picker selectedValue={departmentLookupId} onValueChange={(v) => setDepartmentLookupId(v == null ? null : Number(v))}>
                  <Picker.Item label="-- Not set --" value={null} />
                  {(departments || []).map((d) => (
                    <Picker.Item key={d.lookupId} label={d.name} value={d.lookupId} />
                  ))}
                </Picker>
              </View>

              <Text style={styles.label}>Employee Type</Text>
              <View style={styles.pickerWrap}>
                <Picker selectedValue={employeeTypeLookupId} onValueChange={(v) => setEmployeeTypeLookupId(v == null ? null : Number(v))}>
                  <Picker.Item label="-- Not set --" value={null} />
                  {(employeeTypes || []).map((t) => (
                    <Picker.Item key={t.lookupId} label={t.name} value={t.lookupId} />
                  ))}
                </Picker>
              </View>
            </ScrollView>
          )}

          <View style={styles.actions}>
            <Button title="Cancel" variant="outline" onPress={onClose} disabled={saving} style={{ flex: 1 }} />
            <Button title="Save" onPress={handleSave} loading={saving} style={{ flex: 1 }} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,13,35,0.5)', alignItems: 'center', justifyContent: 'center', padding: spacing(3) },
  box: { width: '100%', backgroundColor: A.surface, borderRadius: radius.md, padding: spacing(2.5) },
  title: { fontSize: 16, fontWeight: '800', color: A.ink },
  subtitle: { fontSize: 12, color: A.muted, marginBottom: spacing(1.5) },
  fieldsScroll: { maxHeight: 420 },
  label: { fontSize: 13, color: A.muted, marginBottom: 6, fontWeight: '500' },
  pickerWrap: { borderWidth: 1, borderColor: A.border, borderRadius: radius.sm, marginBottom: 16, backgroundColor: A.surface },
  actions: { flexDirection: 'row', gap: 10, marginTop: spacing(1) },
});
