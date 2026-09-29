import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { pick, types as DocumentPickerTypes, isErrorWithCode, errorCodes } from '@react-native-documents/picker';
import Button from '../../components/Button';
import { colors, radius, shadow, spacing } from '../../theme';
import {
  commitEmployeeImport,
  EmployeeImportCommitResult,
  EmployeeImportSummary,
  PickedFile,
  previewEmployeeImport,
} from '../../api/adminEmployeeImportApi';

const A = colors.admin;
type Step = 1 | 2 | 3;

const TEMPLATE_COLUMNS = [
  'Code*', 'Employee Name*', 'Display Name', 'Inhouse', 'Mobile No*', 'Email', 'Gender*',
  'Location*', 'Organization*', 'Department', 'Designation', 'Employment Type', 'Salary Type',
  'Employee Type', 'Salary', 'Date Of Joining', 'Date Of Birth', 'Bank Name', 'IFSC Code', 'Account No',
];

/** Mirrors Panel/Employees/Import.aspx — bulk employee create/update from an .xlsx file, 20 columns, row-by-row validation before commit. */
export default function EmployeesImportScreen() {
  const [step, setStep] = useState<Step>(1);
  const [file, setFile] = useState<PickedFile | null>(null);
  const [summary, setSummary] = useState<EmployeeImportSummary | null>(null);
  const [result, setResult] = useState<EmployeeImportCommitResult | null>(null);
  const [busy, setBusy] = useState(false);

  const pickAndPreview = async () => {
    try {
      const [picked] = await pick({ type: [DocumentPickerTypes.xlsx] });
      const pickedFile: PickedFile = { uri: picked.uri, name: picked.name || 'employees.xlsx', type: picked.type || '' };
      setFile(pickedFile);
      setBusy(true);
      const res = await previewEmployeeImport(pickedFile);
      setSummary(res.data.summary);
      setStep(2);
    } catch (err: any) {
      if (isErrorWithCode(err) && err.code === errorCodes.OPERATION_CANCELED) return;
      Alert.alert('Could not read file', err?.response?.data?.message || err?.message || 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleCommit = () => {
    if (!file || !summary) return;
    Alert.alert(
      'Import these records?',
      `This will create ${summary.insertRows} new employee(s) and update ${summary.updateRows} existing one(s). ${summary.errorRows} row(s) with errors will be skipped.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Import',
          onPress: async () => {
            setBusy(true);
            try {
              const res = await commitEmployeeImport(file);
              setResult(res.data.result);
              setStep(3);
            } catch (err: any) {
              Alert.alert('Import failed', err?.response?.data?.message || 'Please try again.');
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  };

  const handleReset = () => {
    setFile(null);
    setSummary(null);
    setResult(null);
    setStep(1);
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.stepRow}>
          {[1, 2, 3].map((s) => (
            <View key={s} style={styles.stepItem}>
              <View style={[styles.stepDot, step >= s && styles.stepDotActive]}>
                <Text style={[styles.stepDotText, step >= s && styles.stepDotTextActive]}>{s}</Text>
              </View>
              {s < 3 && <View style={[styles.stepLine, step > s && styles.stepLineActive]} />}
            </View>
          ))}
        </View>

        {step === 1 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Upload Employees File</Text>
            <Text style={styles.cardSub}>
              Select an .xlsx file with one employee per row, in this column order (row 1 = headers, data from row 2):
            </Text>
            <Text style={styles.columnsText}>{TEMPLATE_COLUMNS.join(' · ')}</Text>
            <Text style={styles.cardSub}>
              Organization, Location, Department, Designation etc. must match names already set up under Organizations / Locations /
              Employee Masters exactly. A row whose Code matches an existing employee updates that record instead of creating a
              duplicate.
            </Text>
            <Button title={busy ? 'Reading File…' : 'Select Excel File'} onPress={pickAndPreview} loading={busy} style={styles.actionBtn} />
          </View>
        )}

        {step === 2 && summary && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Review Before Import</Text>

            <View style={styles.statGrid}>
              <StatCard label="Total Rows" value={summary.totalRows} />
              <StatCard label="Valid" value={summary.validRows} tone="green" />
              <StatCard label="Errors" value={summary.errorRows} tone={summary.errorRows > 0 ? 'red' : undefined} />
              <StatCard label="New" value={summary.insertRows} tone="blue" />
              <StatCard label="Update" value={summary.updateRows} tone="orange" />
            </View>

            {summary.rows.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Rows ({summary.rows.length})</Text>
                {summary.rows.map((row) => (
                  <View key={row.rowNumber} style={[styles.previewRow, !row.isValid && styles.previewRowError]}>
                    <View style={styles.previewRowHead}>
                      <Text style={styles.previewEmp}>
                        #{row.rowNumber} · {row.code} · {row.employeeName}
                      </Text>
                      <View style={[styles.actionPill, row.action === 'Insert' ? styles.actionPillNew : styles.actionPillUpdate]}>
                        <Text style={styles.actionPillText}>{row.action}</Text>
                      </View>
                    </View>
                    <Text style={styles.previewMeta}>
                      {row.department || '—'} · {row.designation || '—'}
                    </Text>
                    {!row.isValid && <Text style={styles.errorText}>{row.errorMessage}</Text>}
                  </View>
                ))}
              </>
            )}

            <View style={styles.modalActions}>
              <Button title="Cancel" variant="outline" onPress={handleReset} style={{ flex: 1 }} />
              <Button
                title={busy ? 'Importing…' : 'Confirm Import'}
                onPress={handleCommit}
                loading={busy}
                disabled={summary.validRows === 0}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        )}

        {step === 3 && result && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Import Complete</Text>
            <Text style={styles.successText}>
              {result.created} employee(s) created, {result.updated} updated.
            </Text>
            {result.skipped > 0 && <Text style={styles.successTextWarn}>{result.skipped} row(s) skipped due to errors.</Text>}
            <Button title="Import Another File" onPress={handleReset} style={styles.actionBtn} />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone?: 'blue' | 'green' | 'orange' | 'red' }) {
  const toneColor = tone === 'blue' ? '#2563eb' : tone === 'green' ? '#15803d' : tone === 'orange' ? '#d97706' : tone === 'red' ? '#dc2626' : A.ink;
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, { color: toneColor }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: A.bg },
  content: { padding: spacing(2), paddingBottom: spacing(5) },

  stepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: spacing(2) },
  stepItem: { flexDirection: 'row', alignItems: 'center' },
  stepDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: A.surface, borderWidth: 1.5, borderColor: A.border, alignItems: 'center', justifyContent: 'center' },
  stepDotActive: { backgroundColor: A.primary, borderColor: A.primary },
  stepDotText: { fontSize: 12, fontWeight: '700', color: A.muted },
  stepDotTextActive: { color: '#fff' },
  stepLine: { width: 32, height: 2, backgroundColor: A.border, marginHorizontal: 4 },
  stepLineActive: { backgroundColor: A.primary },

  card: { backgroundColor: A.surface, borderRadius: radius.md, padding: 16, marginBottom: 16, ...shadow.card },
  cardTitle: { fontSize: 15, fontWeight: '800', color: A.ink, marginBottom: 6 },
  cardSub: { fontSize: 12, color: A.muted, lineHeight: 18, marginBottom: 10 },
  columnsText: { fontSize: 11, color: A.primary, lineHeight: 17, marginBottom: 10, fontWeight: '600' },
  actionBtn: { marginTop: 4 },

  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  statCard: { width: '31%', backgroundColor: A.surfaceRaised, borderRadius: radius.sm, paddingVertical: 10, alignItems: 'center' },
  statValue: { fontSize: 16, fontWeight: '800' },
  statLabel: { fontSize: 9, color: A.muted, marginTop: 2, fontWeight: '600', textAlign: 'center' },

  sectionTitle: { fontSize: 12, fontWeight: '800', color: A.primary, marginBottom: 8, textTransform: 'uppercase' },
  previewRow: { borderWidth: 1, borderColor: A.border, borderRadius: radius.sm, padding: 10, marginBottom: 8 },
  previewRowError: { borderColor: '#fca5a5', backgroundColor: '#fef2f2' },
  previewRowHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  previewEmp: { fontSize: 12, fontWeight: '700', color: A.ink, flex: 1 },
  previewMeta: { fontSize: 11, color: A.muted, marginTop: 2 },
  errorText: { fontSize: 11, color: '#b91c1c', marginTop: 4 },
  actionPill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  actionPillNew: { backgroundColor: '#dbeafe' },
  actionPillUpdate: { backgroundColor: '#fef3c7' },
  actionPillText: { fontSize: 9, fontWeight: '800', color: A.ink },

  modalActions: { flexDirection: 'row', gap: 10, marginTop: spacing(2) },

  successText: { fontSize: 13, color: A.ink, marginBottom: 8, lineHeight: 19 },
  successTextWarn: { fontSize: 13, color: '#b91c1c', marginBottom: 8, lineHeight: 19 },
});
