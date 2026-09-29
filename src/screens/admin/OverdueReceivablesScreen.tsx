import React, { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Picker } from '../../components/AppPicker';
import Button from '../../components/Button';
import TextField from '../../components/TextField';
import { colors, radius, shadow, spacing } from '../../theme';
import { receiveStaffLoanEmi } from '../../api/adminStaffLoanApi';

const A = colors.admin;

export type OverdueItem = {
  emiId: number;
  empName: string;
  empCode: string;
  emiNumber: number;
  totalEMIs: number;
  dueDateDisplay: string;
  daysOverdue: number;
  emiAmount: number;
};

/** Mirrors Panel/Dashboard.aspx's mOverdueReceivable modal — overdue loan EMIs with an inline Receive Payment action. */
export default function OverdueReceivablesScreen({ params }: { params?: { items: OverdueItem[] } }) {
  const [items, setItems] = useState<OverdueItem[]>(params?.items || []);
  const [receiveFor, setReceiveFor] = useState<OverdueItem | null>(null);

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.headerText}>
          {items.length} {items.length === 1 ? 'EMI' : 'EMIs'} overdue
        </Text>

        {items.length === 0 && <Text style={styles.emptyText}>Nothing overdue right now.</Text>}

        {items.map((item) => (
          <View key={item.emiId} style={styles.card}>
            <View style={{ flex: 1 }}>
              <Text style={styles.empName}>
                {item.empName} <Text style={styles.empCode}>· {item.empCode}</Text>
              </Text>
              <Text style={styles.emiMeta}>
                EMI {item.emiNumber}/{item.totalEMIs} · Due {item.dueDateDisplay}
              </Text>
              <View style={styles.badgeRow}>
                <Text style={styles.amount}>₹{item.emiAmount.toLocaleString('en-IN')}</Text>
                <View style={styles.overduePill}>
                  <Text style={styles.overduePillText}>{item.daysOverdue}d overdue</Text>
                </View>
              </View>
            </View>
            <Pressable style={styles.receiveBtn} onPress={() => setReceiveFor(item)}>
              <Text style={styles.receiveBtnText}>Receive</Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>

      {receiveFor && (
        <ReceivePaymentModal
          item={receiveFor}
          onClose={() => setReceiveFor(null)}
          onReceived={() => {
            setItems((cur) => cur.filter((i) => i.emiId !== receiveFor.emiId));
            setReceiveFor(null);
          }}
        />
      )}
    </View>
  );
}

function ReceivePaymentModal({ item, onClose, onReceived }: { item: OverdueItem; onClose: () => void; onReceived: () => void }) {
  const insets = useSafeAreaInsets();
  const [amount, setAmount] = useState(String(item.emiAmount));
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) return Alert.alert('Enter a valid received amount greater than zero.');
    setSaving(true);
    try {
      await receiveStaffLoanEmi(item.emiId, { amount: amt, paymentMode, remarks });
      Alert.alert('Payment Received', `₹${amt.toLocaleString('en-IN')} recorded for ${item.empName}.`);
      onReceived();
    } catch (err: any) {
      Alert.alert('Could not save', err?.response?.data?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={[styles.modalBox, { paddingBottom: spacing(2.5) + insets.bottom }]} onPress={(e) => e.stopPropagation()}>
          <ScrollView>
            <Text style={styles.modalTitle}>Receive Payment</Text>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryLine}>
                {item.empName} · EMI {item.emiNumber}/{item.totalEMIs}
              </Text>
              <Text style={styles.summaryLine}>
                Due {item.dueDateDisplay} · {item.daysOverdue} days overdue
              </Text>
            </View>
            <TextField label="Received Amount *" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
            <Text style={styles.label}>Payment Mode</Text>
            <View style={styles.pickerWrap}>
              <Picker selectedValue={paymentMode} onValueChange={setPaymentMode}>
                <Picker.Item label="Cash" value="Cash" />
                <Picker.Item label="Online Transfer" value="Online Transfer" />
                <Picker.Item label="Credit Note" value="Credit Note" />
                <Picker.Item label="Debit Note" value="Debit Note" />
              </Picker>
            </View>
            <TextField label="Remarks" value={remarks} onChangeText={setRemarks} multiline numberOfLines={2} />

            <View style={styles.modalActions}>
              <Button title="Cancel" variant="outline" onPress={onClose} style={{ flex: 1 }} />
              <Button title="Confirm" onPress={save} loading={saving} style={{ flex: 1 }} />
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: A.bg },
  content: { padding: spacing(2) },
  headerText: { color: A.muted, fontSize: 12, marginBottom: spacing(1) },
  emptyText: { color: A.muted, fontSize: 13, textAlign: 'center', marginTop: spacing(4) },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1.5),
    backgroundColor: A.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: A.border,
    ...shadow.card,
  },
  empName: { fontSize: 14, fontWeight: '700', color: A.ink },
  empCode: { fontWeight: '500', color: A.muted },
  emiMeta: { fontSize: 12, color: A.muted, marginTop: 2 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  amount: { fontSize: 14, fontWeight: '800', color: A.ink },
  overduePill: { backgroundColor: '#fee2e2', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  overduePillText: { fontSize: 10, fontWeight: '800', color: '#b91c1c' },

  receiveBtn: { backgroundColor: A.primary, borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 10 },
  receiveBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,13,35,0.5)', justifyContent: 'flex-end' },
  modalBox: { maxHeight: '92%', backgroundColor: A.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: spacing(2.5) },
  modalTitle: { fontSize: 16, fontWeight: '800', color: A.ink, marginBottom: spacing(1.5) },
  label: { fontSize: 13, color: A.muted, marginBottom: 6, fontWeight: '500' },
  pickerWrap: { borderWidth: 1, borderColor: A.border, borderRadius: radius.sm, marginBottom: 16, backgroundColor: A.surface },
  summaryBox: { backgroundColor: A.surfaceRaised, borderRadius: radius.sm, padding: 12, marginBottom: 16 },
  summaryLine: { fontSize: 12, color: A.ink, marginBottom: 3 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: spacing(1), marginBottom: spacing(2) },
});
