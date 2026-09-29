import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Picker } from '../../components/AppPicker';
import { pick, types as DocumentPickerTypes, isErrorWithCode, errorCodes } from '@react-native-documents/picker';
import Button from '../../components/Button';
import DateField from '../../components/DateField';
import { colors, radius, shadow, spacing } from '../../theme';
import { useAdminNav } from '../../navigation/AdminShell';
import {
  commitOrderUpload,
  lookupOrderBrands,
  previewOrderUpload,
  OrderBrandOption,
  OrderUploadResult,
  OrderUploadSummary,
  PickedFile,
} from '../../api/adminOrderApi';

const A = colors.admin;
type Step = 1 | 2 | 3;

const TEMPLATE_COLUMNS = [
  'Department', 'Category', 'SubCategory', 'ArticleNo', 'CodingType', 'UOMName', 'Description', 'ExtDescription',
  'Color', 'Size', 'Style', 'Brand', 'HSNCode', 'Supplier', 'ItemCode', 'ItemId', 'PurPrice', 'ItemMrp', 'ItemWsp',
  'Quantity', 'InvoiceNo', 'InvoiceDt',
];

/** Mirrors Panel/Orders/Index.aspx's upload wizard — pick Order Date + Brand, pick a
 * .csv/.xlsx file, preview + validate, confirm. .NET runs this as a 4-step session-token
 * dance purely to work around classic ASP.NET's batch/session limits; this REST API
 * collapses it to a stateless preview/commit pair (same as EmployeesImportScreen). */
export default function OrderUploadScreen() {
  const { goBack } = useAdminNav();
  const [step, setStep] = useState<Step>(1);
  const [brands, setBrands] = useState<OrderBrandOption[]>([]);
  const [orderDate, setOrderDate] = useState('');
  const [brandId, setBrandId] = useState<number | null>(null);
  const [file, setFile] = useState<PickedFile | null>(null);
  const [summary, setSummary] = useState<OrderUploadSummary | null>(null);
  const [result, setResult] = useState<OrderUploadResult | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    lookupOrderBrands()
      .then((res) => {
        setBrands(res.data.brands);
        if (res.data.brands.length) setBrandId(res.data.brands[0].id);
      })
      .catch(() => Alert.alert('Could not load brands'));
  }, []);

  const pickAndPreview = async () => {
    if (!orderDate) {
      Alert.alert('Order Date required', 'Please select an Order Date first.');
      return;
    }
    if (!brandId) {
      Alert.alert('Brand required', 'Please select a Brand first.');
      return;
    }
    try {
      const [picked] = await pick({ type: [DocumentPickerTypes.xlsx, DocumentPickerTypes.csv] });
      const pickedFile: PickedFile = { uri: picked.uri, name: picked.name || 'order.xlsx', type: picked.type || '' };
      setFile(pickedFile);
      setBusy(true);
      const res = await previewOrderUpload(pickedFile, brandId);
      if (!res.data.success) {
        Alert.alert('Could not read file', res.data.message || 'Please try again.');
        return;
      }
      setSummary(res.data);
      setStep(2);
    } catch (err: any) {
      if (isErrorWithCode(err) && err.code === errorCodes.OPERATION_CANCELED) return;
      Alert.alert('Could not read file', err?.response?.data?.message || err?.message || 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleCommit = () => {
    if (!file || !summary || !brandId) return;
    Alert.alert(
      'Import this order?',
      `This will create ${summary.validRows} item row(s). ${summary.errorRows} row(s) with errors will be skipped.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Import',
          onPress: async () => {
            setBusy(true);
            try {
              const res = await commitOrderUpload(file, orderDate, brandId);
              if (!res.data.success) {
                Alert.alert('Import failed', res.data.message || 'Please try again.');
                return;
              }
              setResult(res.data);
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
            <Text style={styles.cardTitle}>Upload Order File</Text>
            <Text style={styles.cardSub}>Select the Order Date and Brand, then pick a .csv or .xlsx file with these columns (row 1 = headers):</Text>
            <Text style={styles.columnsText}>{TEMPLATE_COLUMNS.join(' · ')}</Text>

            <DateField label="Order Date" value={orderDate} onChange={setOrderDate} />

            <Text style={styles.label}>Brand</Text>
            <View style={styles.pickerWrap}>
              <Picker selectedValue={brandId ?? undefined} onValueChange={(v) => setBrandId(Number(v))}>
                {brands.map((b) => (
                  <Picker.Item key={b.id} label={b.name} value={b.id} />
                ))}
              </Picker>
            </View>

            <Button title={busy ? 'Reading File…' : 'Select File'} onPress={pickAndPreview} loading={busy} style={styles.actionBtn} />
          </View>
        )}

        {step === 2 && summary && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Review Before Import</Text>

            <View style={styles.statGrid}>
              <StatCard label="Total Rows" value={summary.totalRows} />
              <StatCard label="Valid" value={summary.validRows} tone="green" />
              <StatCard label="Errors" value={summary.errorRows} tone={summary.errorRows > 0 ? 'red' : undefined} />
              <StatCard label="Total Qty" value={summary.totalQuantity} tone="blue" />
              <StatCard label="Total Amt" value={summary.totalAmount} tone="orange" />
            </View>

            {summary.preview.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Rows ({summary.preview.length})</Text>
                {summary.preview.map((row) => (
                  <View key={row.rowNo} style={[styles.previewRow, row.isError && styles.previewRowError]}>
                    <Text style={styles.previewEmp}>
                      #{row.rowNo} · {row.articleNo || '—'} · {row.description || '—'}
                    </Text>
                    <Text style={styles.previewMeta}>
                      {row.color || '—'} / {row.size || '—'} · Qty {row.quantity} · ₹{row.purPrice}
                    </Text>
                    {row.message && <Text style={row.isError ? styles.errorText : styles.warnText}>{row.message}</Text>}
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
              {result.orderNo} created with {result.totalItems} item(s), Qty {result.totalQuantity.toFixed(2)}, ₹{result.totalAmount.toFixed(2)}.
            </Text>
            <Button title="Done" onPress={() => goBack()} style={styles.actionBtn} />
            <Button title="Upload Another File" variant="outline" onPress={handleReset} style={styles.actionBtn} />
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
      <Text style={[styles.statValue, { color: toneColor }]}>{typeof value === 'number' ? (Number.isInteger(value) ? value : value.toFixed(2)) : value}</Text>
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
  columnsText: { fontSize: 11, color: A.primary, lineHeight: 17, marginBottom: 14, fontWeight: '600' },
  label: { fontSize: 13, color: A.muted, marginBottom: 6, fontWeight: '500' },
  pickerWrap: { borderWidth: 1, borderColor: A.border, borderRadius: radius.sm, backgroundColor: A.surface, marginBottom: 16 },
  actionBtn: { marginTop: 4 },

  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  statCard: { width: '31%', backgroundColor: A.surfaceRaised, borderRadius: radius.sm, paddingVertical: 10, alignItems: 'center' },
  statValue: { fontSize: 16, fontWeight: '800' },
  statLabel: { fontSize: 9, color: A.muted, marginTop: 2, fontWeight: '600', textAlign: 'center' },

  sectionTitle: { fontSize: 12, fontWeight: '800', color: A.primary, marginBottom: 8, textTransform: 'uppercase' },
  previewRow: { borderWidth: 1, borderColor: A.border, borderRadius: radius.sm, padding: 10, marginBottom: 8 },
  previewRowError: { borderColor: '#fca5a5', backgroundColor: '#fef2f2' },
  previewEmp: { fontSize: 12, fontWeight: '700', color: A.ink },
  previewMeta: { fontSize: 11, color: A.muted, marginTop: 2 },
  errorText: { fontSize: 11, color: '#b91c1c', marginTop: 4 },
  warnText: { fontSize: 11, color: '#b45309', marginTop: 4 },

  modalActions: { flexDirection: 'row', gap: 10, marginTop: spacing(2) },

  successText: { fontSize: 13, color: A.ink, marginBottom: 14, lineHeight: 19 },
});
