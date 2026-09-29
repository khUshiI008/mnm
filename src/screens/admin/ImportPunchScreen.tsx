import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { pick, types as DocumentPickerTypes, isErrorWithCode, errorCodes } from '@react-native-documents/picker';
import Button from '../../components/Button';
import { colors, radius, shadow, spacing } from '../../theme';
import {
  commitImportPunch,
  ImportCommitResult,
  ImportDryRunSummary,
  PickedFile,
  previewImportPunch,
  reprocessAllAttendance,
} from '../../api/adminImportPunchApi';

const A = colors.admin;

type Step = 1 | 2 | 3;

export default function ImportPunchScreen() {
  const [step, setStep] = useState<Step>(1);
  const [file, setFile] = useState<PickedFile | null>(null);
  const [summary, setSummary] = useState<ImportDryRunSummary | null>(null);
  const [result, setResult] = useState<ImportCommitResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [reprocessing, setReprocessing] = useState(false);

  const pickAndPreview = async () => {
    try {
      const [picked] = await pick({ type: [DocumentPickerTypes.xlsx] });
      const pickedFile: PickedFile = { uri: picked.uri, name: picked.name || 'punches.xlsx', type: picked.type || '' };
      setFile(pickedFile);
      setBusy(true);
      const res = await previewImportPunch(pickedFile);
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
    if (!file) return;
    Alert.alert('Import these records?', `This will insert ${summary?.totalPunches ?? 0} punch records and auto-fill ${summary?.absentDays ?? 0} absent days.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Import',
        onPress: async () => {
          setBusy(true);
          try {
            const res = await commitImportPunch(file);
            setResult(res.data.result);
            setStep(3);
          } catch (err: any) {
            Alert.alert('Import failed', err?.response?.data?.message || 'Please try again.');
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  const handleReset = () => {
    setFile(null);
    setSummary(null);
    setResult(null);
    setStep(1);
  };

  const handleReprocess = () => {
    Alert.alert('Re-process all attendance?', 'This recalculates every attendance record from raw punches using the current attendance policy. Safe to run anytime.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Re-process',
        onPress: async () => {
          setReprocessing(true);
          try {
            const res = await reprocessAllAttendance();
            Alert.alert('Done', res.data.message);
          } catch (err: any) {
            Alert.alert('Could not re-process', err?.response?.data?.message || 'Please try again.');
          } finally {
            setReprocessing(false);
          }
        },
      },
    ]);
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
            <Text style={styles.cardTitle}>Upload Punch File</Text>
            <Text style={styles.cardSub}>
              Select an .xlsx file with employee punch data. Column A must contain the Employee Code; subsequent columns are dates
              (e.g. "01-06-2026") with punch times listed one per line (e.g. "10:09 AM").
            </Text>
            <Button title={busy ? 'Reading File…' : 'Select Excel File'} onPress={pickAndPreview} loading={busy} style={styles.actionBtn} />
          </View>
        )}

        {step === 2 && summary && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Review Before Import</Text>
            <Text style={styles.fileName}>{summary.fileName}</Text>

            <View style={styles.statGrid}>
              <StatCard label="Date Columns" value={summary.totalDateColumns} />
              <StatCard label="Matched Employees" value={summary.matchedEmployees} tone="blue" />
              <StatCard label="Total Punches" value={summary.totalPunches} tone="green" />
              <StatCard label="Days with Punches" value={summary.daysWithPunches} tone="orange" />
              <StatCard label="Absent Days" value={summary.absentDays} tone="red" />
              <StatCard label="Unmatched Codes" value={summary.unmatchedCount} tone={summary.unmatchedCount > 0 ? 'red' : undefined} />
            </View>

            <Text style={styles.rangeText}>
              Date range: <Text style={styles.rangeBold}>{summary.dateFromDisplay}</Text> → <Text style={styles.rangeBold}>{summary.dateToDisplay}</Text>
            </Text>

            {summary.unmatchedCodes.length > 0 && (
              <View style={styles.unmatchedBox}>
                <Text style={styles.unmatchedTitle}>Unmatched employee codes (will be skipped):</Text>
                <Text style={styles.unmatchedCodes}>{summary.unmatchedCodes.join(', ')}</Text>
              </View>
            )}

            {summary.preview.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Preview (first {summary.preview.length} employee-days)</Text>
                {summary.preview.map((row, i) => (
                  <View key={i} style={styles.previewRow}>
                    <Text style={styles.previewEmp}>{row.employeeLabel}</Text>
                    <Text style={styles.previewMeta}>
                      {row.dateDisplay} · In {row.checkInDisplay} · Out {row.checkOutDisplay}
                    </Text>
                    <Text style={styles.previewPunches}>{row.punchesDisplay}</Text>
                  </View>
                ))}
              </>
            )}

            <View style={styles.modalActions}>
              <Button title="Cancel" variant="outline" onPress={handleReset} style={{ flex: 1 }} />
              <Button title={busy ? 'Importing…' : 'Confirm Import'} onPress={handleCommit} loading={busy} style={{ flex: 1 }} />
            </View>
          </View>
        )}

        {step === 3 && result && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Import Complete</Text>
            <Text style={styles.successText}>
              Imported {result.totalPunches} punch records for {result.totalEmployees} employees across {result.totalDays} days
              ({result.absentDaysCount} absent days auto-filled).
            </Text>
            <Text style={styles.successText}>
              Attendance rows — created: {result.attCreated}, updated: {result.attUpdated}.
            </Text>
            {result.unmatchedCodes > 0 && <Text style={styles.successTextWarn}>Unmatched employee codes (skipped): {result.unmatchedCodes}</Text>}
            <Button title="Import Another File" onPress={handleReset} style={styles.actionBtn} />
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Re-process Attendance</Text>
          <Text style={styles.cardSub}>Recalculates every attendance record from stored raw punches using the current attendance policy. Idempotent — safe to run anytime.</Text>
          <Button title="Re-process All" variant="outline" onPress={handleReprocess} loading={reprocessing} style={styles.actionBtn} />
        </View>
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
  cardSub: { fontSize: 12, color: A.muted, lineHeight: 18, marginBottom: 14 },
  actionBtn: { marginTop: 4 },
  fileName: { fontSize: 12, color: A.muted, marginBottom: 12 },

  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  statCard: { width: '31%', backgroundColor: A.surfaceRaised, borderRadius: radius.sm, paddingVertical: 10, alignItems: 'center' },
  statValue: { fontSize: 16, fontWeight: '800' },
  statLabel: { fontSize: 9, color: A.muted, marginTop: 2, fontWeight: '600', textAlign: 'center' },

  rangeText: { fontSize: 12, color: A.muted, marginBottom: 12 },
  rangeBold: { fontWeight: '700', color: A.ink },

  unmatchedBox: { backgroundColor: '#fee2e2', borderRadius: radius.sm, padding: 10, marginBottom: 14 },
  unmatchedTitle: { fontSize: 11, fontWeight: '700', color: '#991b1b', marginBottom: 4 },
  unmatchedCodes: { fontSize: 11, color: '#991b1b' },

  sectionTitle: { fontSize: 12, fontWeight: '800', color: A.primary, marginBottom: 8, textTransform: 'uppercase' },
  previewRow: { borderBottomWidth: 1, borderBottomColor: A.border, paddingVertical: 8 },
  previewEmp: { fontSize: 12, fontWeight: '700', color: A.ink },
  previewMeta: { fontSize: 11, color: A.muted, marginTop: 2 },
  previewPunches: { fontSize: 10, color: A.muted, marginTop: 2, fontStyle: 'italic' },

  modalActions: { flexDirection: 'row', gap: 10, marginTop: spacing(2) },

  successText: { fontSize: 13, color: A.ink, marginBottom: 8, lineHeight: 19 },
  successTextWarn: { fontSize: 13, color: '#b91c1c', marginBottom: 8, lineHeight: 19 },
});
