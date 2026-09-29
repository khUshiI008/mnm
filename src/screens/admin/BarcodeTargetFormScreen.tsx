import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { pick, types as DocumentPickerTypes, isErrorWithCode, errorCodes } from '@react-native-documents/picker';
import Card from '../../components/Card';
import Button from '../../components/Button';
import TextField from '../../components/TextField';
import DateField from '../../components/DateField';
import { colors, radius, spacing } from '../../theme';
import { useAdminNav } from '../../navigation/AdminShell';
import MultiSelectPickerModal, { MultiSelectOption } from '../../components/admin/MultiSelectPickerModal';
import { getEmployees } from '../../api/employeeApi';
import { getTargetLookups, PickerOption } from '../../api/adminTargetGenerateApi';
import {
  createBarcodeTarget,
  updateBarcodeTarget,
  getBarcodeTarget,
  PickedFile,
} from '../../api/adminBarcodeTargetApi';

const A = colors.admin;
type PickerKind = 'brands' | 'employees' | 'managers' | null;

/**
 * Node port of Panel/Sales/BarcodeTarget/Index.aspx.cs's Add/Edit form — a
 * flat per-piece commission tied to an uploaded barcode list, scoped to
 * brands + employees + optional managers, with per-target Employee/Manager
 * Pcs Amount rates (a genuine barcode can override either rate individually
 * — see BarcodeTargetConflictsScreen/the "All Barcodes" list for per-barcode
 * edits; this form only sets the target-level defaults). File re-upload is
 * optional on Edit — omitting it keeps the existing barcode list untouched.
 */
export default function BarcodeTargetFormScreen({ params }: { params?: { barcodeTargetId?: number } }) {
  const { goBack } = useAdminNav();
  const barcodeTargetId = params?.barcodeTargetId;
  const isEdit = !!barcodeTargetId;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [openPicker, setOpenPicker] = useState<PickerKind>(null);

  const [brandOptions, setBrandOptions] = useState<PickerOption[]>([]);
  const [employeeOptions, setEmployeeOptions] = useState<MultiSelectOption[]>([]);
  const [brandIds, setBrandIds] = useState<Set<number>>(new Set());
  const [employeeIds, setEmployeeIds] = useState<Set<number>>(new Set());
  const [managerIds, setManagerIds] = useState<Set<number>>(new Set());

  const [pcsAmount, setPcsAmount] = useState('');
  const [managerPcsAmount, setManagerPcsAmount] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [effectiveTo, setEffectiveTo] = useState('');
  const [file, setFile] = useState<PickedFile | null>(null);
  const [existingBarcodeCount, setExistingBarcodeCount] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [lookupRes, empRes] = await Promise.all([getTargetLookups(), getEmployees({ pageSize: 2000, sortCol: 'EmployeeName' })]);
      setBrandOptions(lookupRes.data.brands);
      setEmployeeOptions(empRes.data.employees.map((e) => ({ id: e.employeeId, label: e.employeeName, sub: e.code })));

      if (barcodeTargetId) {
        const res = await getBarcodeTarget(barcodeTargetId);
        const t = res.data.target;
        setBrandIds(new Set(t.brandIds));
        setEmployeeIds(new Set(t.employeeIds));
        setManagerIds(new Set(t.managerIds));
        setPcsAmount(String(t.pcsAmount));
        setManagerPcsAmount(t.managerPcsAmount != null ? String(t.managerPcsAmount) : '');
        setEffectiveFrom((t.effectiveFrom || '').slice(0, 10));
        setEffectiveTo((t.effectiveTo || '').slice(0, 10));
        setExistingBarcodeCount(t.barcodes.length);
      }
    } catch {
      Alert.alert('Could not load form data');
    } finally {
      setLoading(false);
    }
  }, [barcodeTargetId]);

  useEffect(() => {
    load();
  }, [load]);

  const namesFor = (ids: Set<number>, options: PickerOption[] | MultiSelectOption[]) =>
    options
      .filter((o) => ids.has(o.id))
      .map((o) => ('name' in o ? o.name : o.label))
      .join(', ');

  const pickFile = async () => {
    try {
      const [picked] = await pick({ type: [DocumentPickerTypes.xlsx] });
      setFile({ uri: picked.uri, name: picked.name || 'barcodes.xlsx', type: picked.type || '' });
    } catch (err: any) {
      if (isErrorWithCode(err) && err.code === errorCodes.OPERATION_CANCELED) return;
      Alert.alert('Could not pick file', err?.message || 'Please try again.');
    }
  };

  const handleSave = async () => {
    if (!brandIds.size) return Alert.alert('Select at least one brand.');
    if (!employeeIds.size) return Alert.alert('Select at least one employee.');
    if (!isEdit && !file) return Alert.alert('Please choose a barcode Excel (.xlsx) file to upload.');
    if (!effectiveFrom.trim()) return Alert.alert('Effective From date is required.');

    const amount = pcsAmount.trim() ? Number(pcsAmount) : 0;
    if (!Number.isFinite(amount)) return Alert.alert('Enter a valid Pcs Amount.');
    const mgrAmount = managerPcsAmount.trim() ? Number(managerPcsAmount) : null;

    const payload = {
      brandIds: Array.from(brandIds),
      employeeIds: Array.from(employeeIds),
      managerIds: Array.from(managerIds),
      pcsAmount: amount,
      managerPcsAmount: mgrAmount,
      effectiveFrom,
      effectiveTo: effectiveTo.trim() || null,
    };

    setSaving(true);
    try {
      const res = isEdit ? await updateBarcodeTarget(barcodeTargetId!, payload, file) : await createBarcodeTarget(payload, file!);
      if (!res.data.success) {
        if (res.data.allConflict) {
          Alert.alert('All barcodes already exist', res.data.errors?.join('\n') || 'Every barcode in this file already exists on another target.');
        } else {
          Alert.alert('Could not save', res.data.errors?.join('\n') || 'Please check the form and try again.');
        }
        return;
      }
      Alert.alert('Saved', res.data.message || 'Barcode Target saved.');
      goBack();
    } catch (err: any) {
      const errors: string[] | undefined = err?.response?.data?.errors;
      Alert.alert('Could not save', errors?.join('\n') || err?.response?.data?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={A.primary} />
      </View>
    );
  }

  return (
    <>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Brands, Employees & Managers</Text>
          <PickerButton label="Brands *" hint="Required — at least one" value={namesFor(brandIds, brandOptions)} onPress={() => setOpenPicker('brands')} />
          <PickerButton label="Employees *" hint="Eligible for the per-piece payout" value={namesFor(employeeIds, employeeOptions)} onPress={() => setOpenPicker('employees')} />
          <PickerButton label="Managers (optional)" hint="Get a flat per-piece commission too" value={namesFor(managerIds, employeeOptions)} onPress={() => setOpenPicker('managers')} />
        </Card>

        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Commission & Effective Period</Text>
          <TextField label="Employee Pcs Amount (₹ per piece)" value={pcsAmount} onChangeText={setPcsAmount} keyboardType="numeric" placeholder="0.00" />
          {managerIds.size > 0 && (
            <TextField label="Manager Pcs Amount (₹ per piece)" value={managerPcsAmount} onChangeText={setManagerPcsAmount} keyboardType="numeric" placeholder="0.00" />
          )}
          <Text style={styles.hint}>
            Leave a rate blank only if every barcode in your upload has its own per-barcode override rate (columns B/C of the template).
          </Text>
          <DateField label="Effective From *" granularity="day" value={effectiveFrom} onChange={setEffectiveFrom} placeholder="Select date" />
          <TextField label="Effective To (optional)" value={effectiveTo} onChangeText={setEffectiveTo} placeholder="Leave blank for no end date" />
          <Text style={styles.hint}>Leave Effective To blank to keep this active indefinitely, until turned off manually.</Text>
        </Card>

        <Card style={[styles.sectionCard, { marginBottom: 0 }]}>
          <Text style={styles.sectionTitle}>Barcode List</Text>
          <Text style={styles.hint}>
            Upload an .xlsx file with 3 columns: Barcode Number (required), Employee Per Pcs Amount (optional per-barcode override), Manager
            Per Pcs Amount (optional per-barcode override). A barcode already used on another target is skipped as a conflict — you'll be
            able to view and resolve conflicts after saving.
            {isEdit ? ' Leave the file empty to keep the current barcode list unchanged.' : ''}
          </Text>
          {isEdit && !file && <Text style={styles.currentCountText}>Currently {existingBarcodeCount} barcode(s) on this target.</Text>}
          <Button title={file ? `Selected: ${file.name}` : isEdit ? 'Replace Barcode List (optional)' : 'Select Excel File'} variant={file ? 'outline' : 'primary'} onPress={pickFile} style={{ marginTop: 4 }} />
        </Card>

        <Button title={isEdit ? 'Save Changes' : 'Create Barcode Target'} onPress={handleSave} loading={saving} style={{ marginTop: spacing(2) }} />
      </ScrollView>

      <MultiSelectPickerModal
        visible={openPicker === 'brands'}
        title="Select Brands"
        options={brandOptions.map((o) => ({ id: o.id, label: o.name }))}
        selectedIds={brandIds}
        onChange={setBrandIds}
        onClose={() => setOpenPicker(null)}
      />
      <MultiSelectPickerModal
        visible={openPicker === 'employees'}
        title="Select Employees"
        options={employeeOptions}
        selectedIds={employeeIds}
        onChange={setEmployeeIds}
        onClose={() => setOpenPicker(null)}
      />
      <MultiSelectPickerModal
        visible={openPicker === 'managers'}
        title="Select Managers"
        options={employeeOptions}
        selectedIds={managerIds}
        onChange={setManagerIds}
        onClose={() => setOpenPicker(null)}
      />
    </>
  );
}

function PickerButton({ label, hint, value, onPress }: { label: string; hint: string; value: string; onPress: () => void }) {
  return (
    <View style={styles.pickerBtn}>
      <View style={{ flex: 1 }}>
        <Text style={styles.pickerBtnLabel}>{label}</Text>
        <Text style={styles.pickerBtnValue} numberOfLines={1} onPress={onPress}>
          {value || hint}
        </Text>
      </View>
      <Text style={styles.pickerBtnArrow} onPress={onPress}>
        ›
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: A.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: A.bg },
  content: { padding: spacing(2), paddingBottom: spacing(5) },
  sectionCard: { marginBottom: spacing(2), borderRadius: radius.md },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: A.ink, marginBottom: spacing(1.5) },
  hint: { fontSize: 11, color: A.muted, marginBottom: spacing(1.5), lineHeight: 16 },
  currentCountText: { fontSize: 11.5, color: A.ink, fontWeight: '600', marginBottom: spacing(1) },

  pickerBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: A.border },
  pickerBtnLabel: { fontSize: 12, color: A.muted, marginBottom: 2 },
  pickerBtnValue: { fontSize: 13, color: A.ink, fontWeight: '600' },
  pickerBtnArrow: { fontSize: 20, color: A.muted, marginLeft: 8 },
});
