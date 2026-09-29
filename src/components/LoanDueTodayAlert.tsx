import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Icon from './Icon';
import { colors, radius } from '../theme';
import { getLoanDueTodayStatus } from '../api/loanApi';
import { navigate } from '../navigation/navigationRef';

const E = colors.emp;

/**
 * App-wide "your loan EMI is due TODAY" alert for Brand/StaffLoan EMIs —
 * same scope exclusion as OverdueLoanAlert.tsx (Payroll/Inhouse advances
 * auto-deduct, nothing to act on). Rendered alongside OverdueLoanAlert as a
 * sibling of the Tab.Navigator in EmployeeStack.tsx.
 *
 * Deliberately NOT throttled — re-shows every single time the app is opened
 * on the due date itself (the user explicitly asked for this: "no matter
 * how many times they open the app that day"), unlike OverdueLoanAlert's
 * once-per-day gate. A server-side push (loanDueService.js, 9 AM IST) covers
 * the case where the employee never opens the app at all that day.
 */
export default function LoanDueTodayAlert() {
  const [visible, setVisible] = useState(false);
  const [count, setCount] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const res = await getLoanDueTodayStatus();
        if (!res.data.hasDueToday) return;
        setCount(res.data.count);
        setTotalAmount(res.data.totalAmount);
        setVisible(true);
      } catch {
        // Best-effort — a failed check just means no alert this app open, not a crash.
      }
    })();
  }, []);

  const goToLoans = () => {
    setVisible(false);
    navigate('Loans');
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Icon name="alertCircle" size={56} color="#fff" strokeWidth={2.5} />
          </View>
          <Text style={styles.title}>PAYMENT DUE TODAY</Text>
          <Text style={styles.subtitle}>{count === 1 ? 'A Loan EMI Is Due Today' : 'Loan EMIs Are Due Today'}</Text>

          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              You have {count} EMI{count === 1 ? '' : 's'} due today
            </Text>
            <Text style={styles.infoAmount}>₹{totalAmount.toFixed(2)}</Text>
          </View>

          <Text style={styles.body}>Please pay this amount today.</Text>

          <Pressable style={styles.primaryBtn} onPress={goToLoans}>
            <Text style={styles.primaryBtnText}>Pay Today — View EMI</Text>
          </Pressable>
          <Pressable style={styles.laterBtn} onPress={() => setVisible(false)}>
            <Text style={styles.laterBtnText}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,13,35,0.55)', alignItems: 'center', justifyContent: 'center', padding: 28 },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: E.surface,
    borderRadius: radius.lg,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
  },
  iconWrap: { width: 84, height: 84, borderRadius: 42, backgroundColor: E.yellow, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '800', color: E.yellow, letterSpacing: 0.5 },
  subtitle: { fontSize: 15, fontWeight: '700', color: E.ink, marginTop: 4, marginBottom: 18, textAlign: 'center' },
  infoBox: { width: '100%', backgroundColor: '#fef3c7', borderWidth: 1, borderColor: '#fcd34d', borderRadius: radius.sm, padding: 14, marginBottom: 14, alignItems: 'center' },
  infoText: { fontSize: 13.5, fontWeight: '600', color: '#92400e' },
  infoAmount: { fontSize: 20, fontWeight: '800', color: '#92400e', marginTop: 4 },
  body: { fontSize: 12.5, color: E.muted, textAlign: 'center', lineHeight: 18, marginBottom: 22 },
  primaryBtn: { width: '100%', height: 50, borderRadius: 12, backgroundColor: E.yellow, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  laterBtn: { width: '100%', height: 40, alignItems: 'center', justifyContent: 'center' },
  laterBtnText: { color: E.muted, fontWeight: '600', fontSize: 13 },
});
