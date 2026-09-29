import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from './Icon';
import { colors, radius } from '../theme';
import { getLoanOverdueStatus } from '../api/loanApi';
import { navigate } from '../navigation/navigationRef';

const E = colors.emp;
const LAST_SHOWN_KEY = 'overdueLoanAlert:lastShownDate';

function todayKey() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD, local-enough for a once-a-day gate
}

/**
 * App-wide "you have overdue EMIs" alert for Brand/StaffLoan advances —
 * Payroll (Inhouse) advances are excluded since those auto-deduct from
 * salary and need no employee action (see loanController.js's
 * overdueStatus). Rendered once in EmployeeStack.tsx, as a sibling of the
 * Tab.Navigator rather than inside any one tab, so it's visible no matter
 * which module the employee lands on first — not tied to the Loans screen.
 *
 * Shows at most once per calendar day (AsyncStorage-gated, same throttle
 * convention as NotificationContext.tsx's anniversary modal) — dismissing it
 * doesn't clear the underlying due, so it reappears tomorrow if still unpaid,
 * and stops appearing entirely once the EMI(s) are actually received.
 */
export default function OverdueLoanAlert() {
  const [visible, setVisible] = useState(false);
  const [count, setCount] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const res = await getLoanOverdueStatus();
        if (!res.data.hasOverdue) return;

        const lastShown = await AsyncStorage.getItem(LAST_SHOWN_KEY);
        if (lastShown === todayKey()) return;

        setCount(res.data.count);
        setTotalAmount(res.data.totalAmount);
        setVisible(true);
        await AsyncStorage.setItem(LAST_SHOWN_KEY, todayKey());
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
          <Text style={styles.title}>ATTENTION!</Text>
          <Text style={styles.subtitle}>{count === 1 ? 'A Loan EMI Is Overdue' : 'Your Loan EMIs Are Overdue'}</Text>

          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              You have {count} overdue EMI{count === 1 ? '' : 's'}
            </Text>
            <Text style={styles.infoAmount}>Total Overdue: ₹{totalAmount.toFixed(2)}</Text>
          </View>

          <Text style={styles.body}>Please clear this with HR/Admin as soon as possible.</Text>

          <Pressable style={styles.primaryBtn} onPress={goToLoans}>
            <Text style={styles.primaryBtnText}>⚠ View My Overdue EMIs</Text>
          </Pressable>
          <Pressable style={styles.laterBtn} onPress={() => setVisible(false)}>
            <Text style={styles.laterBtnText}>Remind me later</Text>
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
  iconWrap: { width: 84, height: 84, borderRadius: 42, backgroundColor: E.red, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '800', color: E.red, letterSpacing: 0.5 },
  subtitle: { fontSize: 15, fontWeight: '700', color: E.ink, marginTop: 4, marginBottom: 18, textAlign: 'center' },
  infoBox: { width: '100%', backgroundColor: '#fee2e2', borderWidth: 1, borderColor: '#fca5a5', borderRadius: radius.sm, padding: 14, marginBottom: 14, alignItems: 'center' },
  infoText: { fontSize: 13.5, fontWeight: '600', color: E.red },
  infoAmount: { fontSize: 17, fontWeight: '800', color: E.red, marginTop: 4 },
  body: { fontSize: 12.5, color: E.muted, textAlign: 'center', lineHeight: 18, marginBottom: 22 },
  primaryBtn: { width: '100%', height: 50, borderRadius: 12, backgroundColor: E.red, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  laterBtn: { width: '100%', height: 40, alignItems: 'center', justifyContent: 'center' },
  laterBtnText: { color: E.muted, fontWeight: '600', fontSize: 13 },
});
