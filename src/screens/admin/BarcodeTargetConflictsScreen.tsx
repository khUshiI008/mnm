import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text } from 'react-native';
import { pick, types as DocumentPickerTypes, isErrorWithCode, errorCodes } from '@react-native-documents/picker';
import Card from '../../components/Card';
import Button from '../../components/Button';
import { colors, radius, spacing } from '../../theme';
import { useAdminNav } from '../../navigation/AdminShell';
import { getBarcodeConflicts, resolveBarcodeConflict, ConflictRow, PickedFile } from '../../api/adminBarcodeTargetApi';

const A = colors.admin;

/**
 * Node port of the Conflicts modal on Panel/Sales/BarcodeTarget/Index.aspx —
 * lists barcode numbers rejected because they already exist on another
 * target, and lets the admin "Proceed with Conflict": re-upload a corrected
 * file that only ADDS the newly-genuine rows, leaving brands/employees/
 * managers/dates untouched.
 */
export default function BarcodeTargetConflictsScreen({ params }: { params?: { barcodeTargetId?: number } }) {
  const { goBack } = useAdminNav();
  const barcodeTargetId = params?.barcodeTargetId as number;
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ConflictRow[]>([]);
  const [file, setFile] = useState<PickedFile | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getBarcodeConflicts(barcodeTargetId);
      setRows(res.data.conflicts);
    } catch {
      Alert.alert('Could not load conflicts');
    } finally {
      setLoading(false);
    }
  }, [barcodeTargetId]);

  useEffect(() => {
    load();
  }, [load]);

  const pickFile = async () => {
    try {
      const [picked] = await pick({ type: [DocumentPickerTypes.xlsx] });
      setFile({ uri: picked.uri, name: picked.name || 'corrected.xlsx', type: picked.type || '' });
    } catch (err: any) {
      if (isErrorWithCode(err) && err.code === errorCodes.OPERATION_CANCELED) return;
      Alert.alert('Could not pick file', err?.message || 'Please try again.');
    }
  };

  const handleProceed = async () => {
    if (!file) return Alert.alert('Please choose a corrected Excel (.xlsx) file to upload.');
    setSaving(true);
    try {
      const res = await resolveBarcodeConflict(barcodeTargetId, file);
      if (!res.data.success) {
        Alert.alert('Could not resolve', res.data.errors?.join('\n') || 'Please try again.');
        return;
      }
      Alert.alert('Done', res.data.message || 'Conflicts processed.');
      if (!res.data.stillConflictingCount) {
        goBack();
      } else {
        setFile(null);
        load();
      }
    } catch (err: any) {
      Alert.alert('Could not resolve', err?.response?.data?.errors?.join('\n') || err?.response?.data?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <ActivityIndicator size="large" color={A.primary} style={styles.loader} />;
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.hint}>
        These barcode number(s) were skipped because they already exist on another Barcode Target. Fix the numbers in your file and
        re-upload — only the corrected rows will be added; brands, employees, managers, and dates stay unchanged.
      </Text>
      {rows.length === 0 ? (
        <Text style={styles.emptyText}>No conflicts remaining.</Text>
      ) : (
        rows.map((r) => (
          <Card key={r.id} style={styles.row}>
            <Text style={styles.barcodeText}>{r.barcodeNumber}</Text>
            {(r.pcsAmount != null || r.managerPcsAmount != null) && (
              <Text style={styles.rateText}>
                {r.pcsAmount != null ? `Emp: ₹${r.pcsAmount}/pc` : ''} {r.managerPcsAmount != null ? `Mgr: ₹${r.managerPcsAmount}/pc` : ''}
              </Text>
            )}
          </Card>
        ))
      )}

      <Button title={file ? `Selected: ${file.name}` : 'Select Corrected Excel File'} variant={file ? 'outline' : 'primary'} onPress={pickFile} style={{ marginTop: spacing(2) }} />
      <Button title="Proceed with Conflict" onPress={handleProceed} loading={saving} style={{ marginTop: spacing(1.5) }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: A.bg },
  loader: { marginTop: spacing(4) },
  content: { padding: spacing(2), paddingBottom: spacing(5) },
  hint: { fontSize: 12, color: A.muted, marginBottom: spacing(2), lineHeight: 17 },
  emptyText: { color: A.muted, fontSize: 13, textAlign: 'center', marginTop: spacing(2) },
  row: { padding: 12, marginBottom: 8, borderRadius: radius.sm },
  barcodeText: { fontSize: 13, fontWeight: '700', color: A.ink },
  rateText: { fontSize: 11, color: A.muted, marginTop: 2 },
});
