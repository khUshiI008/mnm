import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Picker } from '../../components/AppPicker';
import Card from '../../components/Card';
import Button from '../../components/Button';
import TextField from '../../components/TextField';
import DateField from '../../components/DateField';
import ShiftFormModal from '../../components/admin/ShiftFormModal';
import SearchableSelect from '../../components/common/SearchableSelect';
import MultiSelectPickerModal, { MultiSelectOption } from '../../components/admin/MultiSelectPickerModal';
import { colors, radius, spacing } from '../../theme';
import { useAdminNav } from '../../navigation/AdminShell';
import { usePermission, useAllowedFields } from '../../hooks/usePermission';
import {
  createEmployee,
  EmployeeFormPayload,
  getEmployee,
  getLookupOptions,
  LookupOption,
  LookupOptions,
  quickAddLookup,
  updateEmployee,
} from '../../api/employeeApi';
import { assignEmployeeShift, getShiftAssignmentHistory, getShiftDropdown, ShiftAssignmentHistoryItem, ShiftDropdownOption } from '../../api/adminShiftApi';

const A = colors.admin;

const EMPTY: EmployeeFormPayload = {
  code: '',
  biometricMachineCode: '',
  employeeName: '',
  displayName: '',
  mobileNo: '',
  brandMobileNo: '',
  email: '',
  gender: 'Male',
  dateOfBirth: null,
  maritalStatus: '',
  anniversaryDate: null,
  salesSalespersonId: null,
  organizationId: 0,
  locationId: 0,
  inhouseLookupId: null,
  departmentLookupId: null,
  designationLookupId: null,
  employmentTypeLookupId: null,
  salaryTypeLookupId: null,
  employeeTypeLookupId: null,
  salary: 0,
  dateOfJoining: null,
  weekOffCompensation: 'Unpaid',
  generatePayroll: true,
  bankName: '',
  ifscCode: '',
  accountNo: '',
  brandIds: [],
  deptIds: [],
};

type QuickAddTarget = { masterType: string; label: string; onDone: (opt: LookupOption) => void } | null;

export default function EmployeeFormScreen({ params }: { params?: { employeeId?: number } }) {
  const { goBack } = useAdminNav();
  const employeeId = params?.employeeId;
  const isEdit = !!employeeId;
  const canEdit = usePermission('Employee', 'Edit');
  const canSave = isEdit ? canEdit : usePermission('Employee', 'Create');
  const allowedFields = useAllowedFields('Employee', 'Edit');
  // Only edit mode is field-restricted (Create is its own, all-or-nothing action) — admin's
  // useAllowedFields always returns null (unrestricted) here too.
  const fieldEditable = (key: keyof EmployeeFormPayload) => !isEdit || allowedFields === null || allowedFields.includes(key);

  const [form, setForm] = useState<EmployeeFormPayload>(EMPTY);
  const [lookups, setLookups] = useState<LookupOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [quickAdd, setQuickAdd] = useState<QuickAddTarget>(null);
  const [openPicker, setOpenPicker] = useState<'brands' | 'depts' | null>(null);

  // Shift Assignment — inline here so editing details and assigning a shift
  // are both done from the same screen instead of navigating away.
  const [shifts, setShifts] = useState<ShiftDropdownOption[]>([]);
  const [shiftHistory, setShiftHistory] = useState<ShiftAssignmentHistoryItem[]>([]);
  const [shiftId, setShiftId] = useState(0);
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [assigningShift, setAssigningShift] = useState(false);
  const [shiftQuickAdd, setShiftQuickAdd] = useState(false);
  const currentShift = shiftHistory.find((h) => h.isCurrent);

  const set = <K extends keyof EmployeeFormPayload>(key: K, value: EmployeeFormPayload[K]) => setForm((f) => ({ ...f, [key]: value }));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const lookupRes = await getLookupOptions();
      setLookups(lookupRes.data);
      if (employeeId) {
        const [empRes, shiftRes, historyRes] = await Promise.all([getEmployee(employeeId), getShiftDropdown(), getShiftAssignmentHistory(employeeId)]);
        const detail = { ...empRes.data.employee } as Partial<EmployeeFormPayload> & { employeeId?: number };
        delete detail.employeeId;
        setForm(detail as EmployeeFormPayload);
        setShifts(shiftRes.data.shifts);
        setShiftHistory(historyRes.data.history);
      } else {
        setForm({
          ...EMPTY,
          organizationId: lookupRes.data.organizations[0]?.organizationId || 0,
          locationId: lookupRes.data.locations[0]?.locationId || 0,
        });
      }
    } catch {
      Alert.alert('Could not load form data');
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    load();
  }, [load]);

  const reloadShiftData = useCallback(async () => {
    if (!employeeId) return;
    try {
      const [shiftRes, historyRes] = await Promise.all([getShiftDropdown(), getShiftAssignmentHistory(employeeId)]);
      setShifts(shiftRes.data.shifts);
      setShiftHistory(historyRes.data.history);
    } catch {
      /* non-fatal — the section just keeps showing what it already had */
    }
  }, [employeeId]);

  const handleAssignShift = async () => {
    if (!employeeId) return;
    if (!shiftId) return Alert.alert('Please select a shift.');
    if (!effectiveFrom) return Alert.alert('Please enter an effective date.');

    setAssigningShift(true);
    try {
      const res = await assignEmployeeShift(employeeId, { shiftId, effectiveFrom });
      Alert.alert('Shift assigned', res.data.message);
      setShiftId(0);
      setEffectiveFrom('');
      await reloadShiftData();
    } catch (err: any) {
      Alert.alert('Could not assign shift', err?.response?.data?.message || 'Please try again.');
    } finally {
      setAssigningShift(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = isEdit ? await updateEmployee(employeeId!, form) : await createEmployee(form);
      Alert.alert('Saved', res.data.message);
      goBack();
    } catch (err: any) {
      Alert.alert('Could not save', err?.response?.data?.message || 'Please check the form and try again.');
    } finally {
      setSaving(false);
    }
  };

  const openQuickAdd = (masterType: string, label: string, onDone: (opt: LookupOption) => void) => {
    setQuickAdd({ masterType, label, onDone });
  };

  if (loading || !lookups) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={A.primary} />
      </View>
    );
  }

  return (
    <>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <SectionCard title="Identity">
          <TextField label="Code *" value={form.code} onChangeText={(v) => set('code', v)} maxLength={30} autoCapitalize="none" editable={fieldEditable('code')} />
          <TextField label="Biometric Machine Code" value={form.biometricMachineCode} onChangeText={(v) => set('biometricMachineCode', v)} maxLength={20} editable={fieldEditable('biometricMachineCode')} />
          <TextField label="Employee Name *" value={form.employeeName} onChangeText={(v) => set('employeeName', v)} maxLength={150} editable={fieldEditable('employeeName')} />
          <TextField label="Display Name" value={form.displayName} onChangeText={(v) => set('displayName', v)} maxLength={150} editable={fieldEditable('displayName')} />

          <Text style={styles.label}>Sales Staff Name</Text>
          <SearchableSelect
            enabled={fieldEditable('salesSalespersonId')}
            selectedValue={form.salesSalespersonId ?? 0}
            onValueChange={(v) => set('salesSalespersonId', Number(v) || null)}
            items={[{ label: '-- None --', value: 0 }, ...lookups.salesStaff.map((s) => ({ label: s.name, value: s.salesSalespersonId }))]}
            placeholder="-- Select Sales Staff --"
            searchPlaceholder="Search sales staff"
            title="Select Sales Staff Name"
          />

          <PickerButton
            label="Brand(s)"
            hint="-- None selected --"
            value={lookups.brands.filter((b) => form.brandIds.includes(b.salesBrandId)).map((b) => b.name).join(', ')}
            onPress={() => setOpenPicker('brands')}
            disabled={!fieldEditable('brandIds')}
          />
          <PickerButton
            label="Department(s) (Sales)"
            hint="-- None selected --"
            value={lookups.depts.filter((d) => form.deptIds.includes(d.salesDepartmentId)).map((d) => d.name).join(', ')}
            onPress={() => setOpenPicker('depts')}
            disabled={!fieldEditable('deptIds')}
          />

          <TextField label="Mobile No *" value={form.mobileNo} onChangeText={(v) => set('mobileNo', v)} maxLength={10} keyboardType="number-pad" editable={fieldEditable('mobileNo')} />
          <TextField label="Brand Mobile No" value={form.brandMobileNo} onChangeText={(v) => set('brandMobileNo', v)} maxLength={10} keyboardType="number-pad" editable={fieldEditable('brandMobileNo')} />
          <TextField label="Email" value={form.email} onChangeText={(v) => set('email', v)} keyboardType="email-address" autoCapitalize="none" editable={fieldEditable('email')} />

          <Text style={styles.label}>Gender *</Text>
          <PickerWrap>
            <Picker style={styles.pickerText} enabled={fieldEditable('gender')} selectedValue={form.gender} onValueChange={(v) => set('gender', v)}>
              <Picker.Item label="Male" value="Male" />
              <Picker.Item label="Female" value="Female" />
              <Picker.Item label="Other" value="Other" />
            </Picker>
          </PickerWrap>

          <DateField label="Date of Birth" granularity="day" value={form.dateOfBirth || ''} onChange={(v) => set('dateOfBirth', v || null)} placeholder="Select date" disabled={!fieldEditable('dateOfBirth')} clearable />

          <Text style={styles.label}>Marital Status</Text>
          <PickerWrap>
            <Picker style={styles.pickerText} enabled={fieldEditable('maritalStatus')} selectedValue={form.maritalStatus} onValueChange={(v) => set('maritalStatus', v)}>
              <Picker.Item label="-- Select --" value="" />
              <Picker.Item label="Single" value="Single" />
              <Picker.Item label="Married" value="Married" />
            </Picker>
          </PickerWrap>
          {form.maritalStatus === 'Married' && (
            <DateField label="Anniversary Date" granularity="day" value={form.anniversaryDate || ''} onChange={(v) => set('anniversaryDate', v || null)} placeholder="Select date" disabled={!fieldEditable('anniversaryDate')} clearable />
          )}
        </SectionCard>

        <SectionCard title="Organization & Placement">
          <Text style={styles.label}>Organization *</Text>
          <SearchableSelect
            enabled={fieldEditable('organizationId')}
            selectedValue={form.organizationId}
            onValueChange={(v) => set('organizationId', Number(v))}
            items={lookups.organizations.map((o) => ({ label: o.name, value: o.organizationId }))}
            placeholder="-- Select Organization --"
            searchPlaceholder="Search organization"
            title="Select Organization"
          />

          <Text style={styles.label}>Location *</Text>
          <SearchableSelect
            enabled={fieldEditable('locationId')}
            selectedValue={form.locationId}
            onValueChange={(v) => set('locationId', Number(v))}
            items={lookups.locations.map((l) => ({ label: l.name, value: l.locationId }))}
            placeholder="-- Select Location --"
            searchPlaceholder="Search location"
            title="Select Location"
          />

          <LookupPickerWithQuickAdd
            label="Inhouse Type"
            masterType="InhouseType"
            options={lookups.inhouseTypes}
            value={form.inhouseLookupId}
            editable={fieldEditable('inhouseLookupId')}
            onChange={(v) => set('inhouseLookupId', v)}
            onQuickAdd={() => openQuickAdd('InhouseType', 'Inhouse Type', (opt) => {
              setLookups((l) => (l ? { ...l, inhouseTypes: [...l.inhouseTypes, opt] } : l));
              set('inhouseLookupId', opt.lookupId);
            })}
          />
          <LookupPickerWithQuickAdd
            label="Department"
            masterType="Department"
            options={lookups.departments}
            value={form.departmentLookupId}
            editable={fieldEditable('departmentLookupId')}
            onChange={(v) => set('departmentLookupId', v)}
            onQuickAdd={() => openQuickAdd('Department', 'Department', (opt) => {
              setLookups((l) => (l ? { ...l, departments: [...l.departments, opt] } : l));
              set('departmentLookupId', opt.lookupId);
            })}
          />
          <LookupPickerWithQuickAdd
            label="Designation"
            masterType="Designation"
            options={lookups.designations}
            value={form.designationLookupId}
            editable={fieldEditable('designationLookupId')}
            onChange={(v) => set('designationLookupId', v)}
            onQuickAdd={() => openQuickAdd('Designation', 'Designation', (opt) => {
              setLookups((l) => (l ? { ...l, designations: [...l.designations, opt] } : l));
              set('designationLookupId', opt.lookupId);
            })}
          />
        </SectionCard>

        <SectionCard title="Employment Details">
          <LookupPickerWithQuickAdd
            label="Employment Type"
            masterType="EmploymentType"
            options={lookups.employmentTypes}
            value={form.employmentTypeLookupId}
            editable={fieldEditable('employmentTypeLookupId')}
            onChange={(v) => set('employmentTypeLookupId', v)}
            onQuickAdd={() => openQuickAdd('EmploymentType', 'Employment Type', (opt) => {
              setLookups((l) => (l ? { ...l, employmentTypes: [...l.employmentTypes, opt] } : l));
              set('employmentTypeLookupId', opt.lookupId);
            })}
          />
          <LookupPickerWithQuickAdd
            label="Salary Type"
            masterType="SalaryType"
            options={lookups.salaryTypes}
            value={form.salaryTypeLookupId}
            editable={fieldEditable('salaryTypeLookupId')}
            onChange={(v) => set('salaryTypeLookupId', v)}
            onQuickAdd={() => openQuickAdd('SalaryType', 'Salary Type', (opt) => {
              setLookups((l) => (l ? { ...l, salaryTypes: [...l.salaryTypes, opt] } : l));
              set('salaryTypeLookupId', opt.lookupId);
            })}
          />
          <LookupPickerWithQuickAdd
            label="Employee Type"
            masterType="EmployeeType"
            options={lookups.employeeTypes}
            value={form.employeeTypeLookupId}
            editable={fieldEditable('employeeTypeLookupId')}
            onChange={(v) => set('employeeTypeLookupId', v)}
            onQuickAdd={() => openQuickAdd('EmployeeType', 'Employee Type', (opt) => {
              setLookups((l) => (l ? { ...l, employeeTypes: [...l.employeeTypes, opt] } : l));
              set('employeeTypeLookupId', opt.lookupId);
            })}
          />

          <TextField label="Salary" value={form.salary ? String(form.salary) : ''} onChangeText={(v) => set('salary', v ? Number(v) : 0)} keyboardType="decimal-pad" editable={fieldEditable('salary')} />
          <DateField label="Date of Joining" granularity="day" value={form.dateOfJoining || ''} onChange={(v) => set('dateOfJoining', v || null)} placeholder="Select date" disabled={!fieldEditable('dateOfJoining')} clearable />

          <Text style={styles.label}>Week-Off Working Compensation</Text>
          <PickerWrap>
            <Picker style={styles.pickerText} enabled={fieldEditable('weekOffCompensation')} selectedValue={form.weekOffCompensation} onValueChange={(v) => set('weekOffCompensation', v)}>
              <Picker.Item label="Unpaid" value="Unpaid" />
              <Picker.Item label="Paid" value="Paid" />
            </Picker>
          </PickerWrap>

          <Text style={styles.label}>Generate Payroll</Text>
          <PickerWrap>
            <Picker style={styles.pickerText} enabled={fieldEditable('generatePayroll')} selectedValue={form.generatePayroll ? 'Yes' : 'No'} onValueChange={(v) => set('generatePayroll', v === 'Yes')}>
              <Picker.Item label="Yes" value="Yes" />
              <Picker.Item label="No" value="No" />
            </Picker>
          </PickerWrap>
        </SectionCard>

        <SectionCard title="Bank Details" last={!isEdit}>
          <TextField label="Bank Name" value={form.bankName} onChangeText={(v) => set('bankName', v)} maxLength={150} editable={fieldEditable('bankName')} />
          <TextField label="IFSC Code" value={form.ifscCode} onChangeText={(v) => set('ifscCode', v.toUpperCase())} maxLength={11} autoCapitalize="characters" editable={fieldEditable('ifscCode')} />
          <TextField label="Account No" value={form.accountNo} onChangeText={(v) => set('accountNo', v)} maxLength={20} keyboardType="number-pad" editable={fieldEditable('accountNo')} />
        </SectionCard>

        {/* Only meaningful once the employee actually exists — a new, unsaved employee has no id to assign a shift to. */}
        {isEdit && canEdit && (
          <SectionCard title="Shift Assignment" last>
            <Text style={styles.label}>Current Shift</Text>
            <Text style={styles.currentShiftText}>{currentShift ? currentShift.shiftLabel : 'No shift assigned yet.'}</Text>

            <View style={styles.lookupLabelRow}>
              <Text style={styles.label}>New Shift</Text>
              <Text style={styles.quickAddLink} onPress={() => setShiftQuickAdd(true)}>
                + Add new
              </Text>
            </View>
            <SearchableSelect
              selectedValue={shiftId}
              onValueChange={(v) => setShiftId(Number(v))}
              items={shifts.map((s) => ({ label: s.label, value: s.shiftId }))}
              placeholder="-- Select Shift --"
              searchPlaceholder="Search shift"
              title="Select Shift"
            />

            <DateField label="Effective From" granularity="day" value={effectiveFrom} onChange={setEffectiveFrom} placeholder="Select date" />
            <Button title="Assign Shift" onPress={handleAssignShift} loading={assigningShift} style={{ marginTop: spacing(1) }} />
          </SectionCard>
        )}

        {canSave && <Button title={isEdit ? 'Save Changes' : 'Create Employee'} onPress={handleSave} loading={saving} style={{ marginTop: spacing(1) }} />}
      </ScrollView>

      <QuickAddModal target={quickAdd} onClose={() => setQuickAdd(null)} />

      <MultiSelectPickerModal
        visible={openPicker === 'brands'}
        title="Select Brand(s)"
        options={lookups.brands.map((b): MultiSelectOption => ({ id: b.salesBrandId, label: b.name }))}
        selectedIds={new Set(form.brandIds)}
        onChange={(ids) => set('brandIds', Array.from(ids))}
        onClose={() => setOpenPicker(null)}
      />
      <MultiSelectPickerModal
        visible={openPicker === 'depts'}
        title="Select Department(s) (Sales)"
        options={lookups.depts.map((d): MultiSelectOption => ({ id: d.salesDepartmentId, label: d.name }))}
        selectedIds={new Set(form.deptIds)}
        onChange={(ids) => set('deptIds', Array.from(ids))}
        onClose={() => setOpenPicker(null)}
      />

      {shiftQuickAdd && (
        <ShiftFormModal
          onClose={() => setShiftQuickAdd(false)}
          onSaved={async (newShiftId) => {
            setShiftQuickAdd(false);
            await reloadShiftData();
            setShiftId(newShiftId);
          }}
        />
      )}
    </>
  );
}

function SectionCard({ title, children, last }: { title: string; children: React.ReactNode; last?: boolean }) {
  return (
    <Card style={[styles.sectionCard, last && { marginBottom: 0 }]}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </Card>
  );
}

function PickerWrap({ children }: { children: React.ReactNode }) {
  return <View style={styles.pickerWrap}>{children}</View>;
}

function PickerButton({
  label,
  hint,
  value,
  onPress,
  disabled,
}: {
  label: string;
  hint: string;
  value: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable style={styles.pickerBtn} onPress={onPress} disabled={disabled}>
      <View style={{ flex: 1 }}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.pickerBtnValue} numberOfLines={1}>
          {value || hint}
        </Text>
      </View>
      {!disabled && <Text style={styles.pickerBtnArrow}>›</Text>}
    </Pressable>
  );
}

function LookupPickerWithQuickAdd({
  label,
  options,
  value,
  editable = true,
  onChange,
  onQuickAdd,
}: {
  label: string;
  masterType: string;
  options: LookupOption[];
  value: number | null;
  editable?: boolean;
  onChange: (v: number | null) => void;
  onQuickAdd: () => void;
}) {
  return (
    <View style={{ marginBottom: 16 }}>
      <View style={styles.lookupLabelRow}>
        <Text style={styles.label}>{label}</Text>
        {editable && (
          <Text style={styles.quickAddLink} onPress={onQuickAdd}>
            + Add new
          </Text>
        )}
      </View>
      <PickerWrap>
        <Picker style={styles.pickerText} enabled={editable} selectedValue={value ?? 0} onValueChange={(v) => onChange(Number(v) || null)}>
          <Picker.Item label="-- None --" value={0} />
          {options.map((o) => (
            <Picker.Item key={o.lookupId} label={o.name} value={o.lookupId} />
          ))}
        </Picker>
      </PickerWrap>
    </View>
  );
}

function QuickAddModal({ target, onClose }: { target: QuickAddTarget; onClose: () => void }) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName('');
  }, [target]);

  if (!target) return null;

  const save = async () => {
    setSaving(true);
    try {
      const res = await quickAddLookup(target.masterType, name);
      target.onDone({ lookupId: res.data.lookupId, name: res.data.name });
      onClose();
    } catch (err: any) {
      Alert.alert('Could not add', err?.response?.data?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalBox} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.modalTitle}>Add {target.label}</Text>
          <TextField label={`${target.label} Name`} value={name} onChangeText={setName} autoFocus />
          <View style={styles.modalActions}>
            <Button title="Cancel" variant="outline" onPress={onClose} style={{ flex: 1 }} />
            <Button title="Save" onPress={save} loading={saving} style={{ flex: 1 }} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: A.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: A.bg },
  content: { padding: spacing(2), paddingBottom: spacing(5) },
  sectionCard: { marginBottom: spacing(2), borderRadius: radius.md },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: A.ink, marginBottom: spacing(1.5) },
  label: { fontSize: 13, color: A.muted, marginBottom: 6, fontWeight: '500' },
  pickerWrap: { borderWidth: 1, borderColor: A.border, borderRadius: radius.sm, marginBottom: 16, backgroundColor: A.surface },
  pickerText: { color: A.ink, backgroundColor: A.surface },
  lookupLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  quickAddLink: { fontSize: 12, color: A.primary, fontWeight: '700', marginBottom: 6 },
  currentShiftText: { fontSize: 14, color: A.ink, fontWeight: '600', marginBottom: 16 },
  pickerBtn: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  pickerBtnValue: { fontSize: 14, color: A.ink, fontWeight: '600' },
  pickerBtnArrow: { fontSize: 20, color: A.muted, marginLeft: 8 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,13,35,0.5)', alignItems: 'center', justifyContent: 'center', padding: spacing(3) },
  modalBox: { width: '100%', backgroundColor: A.surface, borderRadius: radius.md, padding: spacing(2.5) },
  modalTitle: { fontSize: 16, fontWeight: '800', color: A.ink, marginBottom: spacing(1.5) },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: spacing(1) },
});
