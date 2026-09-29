import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Card from '../../components/Card';
import Icon from '../../components/Icon';
import { colors, spacing } from '../../theme';
import { getPayslipDetail, PayslipDetail } from '../../api/payslipApi';
import { shareAuthedFile } from '../../utils/shareMedia';
import { safeFilePart } from '../../utils/reportShare';

export default function PayslipDetailScreen({ route }: any) {
  const { payrollId } = route.params;
  const [slip, setSlip] = useState<PayslipDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    getPayslipDetail(payrollId)
      .then((res) => setSlip(res.data))
      .finally(() => setLoading(false));
  }, [payrollId]);

  const downloadPdf = async () => {
    if (!slip || downloading) return;
    setDownloading(true);
    try {
      const monthKey = new Date(slip.payrollMonth).toISOString().slice(0, 7);
      const filename = `Payslip_${safeFilePart(slip.employee.name)}_${monthKey}.pdf`;
      await shareAuthedFile(`/payslips/${payrollId}/pdf`, filename, 'application/pdf');
    } catch (err: any) {
      if (!err?.message || !/cancel/i.test(err.message)) Alert.alert('Could not download', 'Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }
  if (!slip) {
    return (
      <View style={styles.center}>
        <Text style={{ color: colors.textMuted }}>Payslip not found.</Text>
      </View>
    );
  }

  const att = slip.attendance;
  const earn = slip.earnings;
  const ded = slip.deductions;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: spacing(2), paddingBottom: spacing(5) }}>
      <Card style={{ marginBottom: spacing(2) }}>
        <Text style={styles.company}>{slip.employee.name}</Text>
        <Text style={styles.sub}>
          {slip.employee.code} · {slip.employee.department || '—'} · {slip.employee.designation || '—'}
        </Text>
        <Text style={styles.sub}>{monthName(slip.payrollMonth)}</Text>
        {!!slip.generatedAt && <Text style={styles.sub}>Generated On: {formatDate(slip.generatedAt)}</Text>}
        <Pressable style={styles.downloadBtn} onPress={downloadPdf} disabled={downloading}>
          {downloading ? <ActivityIndicator size="small" color={colors.primary} /> : <Icon name="download" size={15} color={colors.primary} />}
          <Text style={styles.downloadBtnText}>Download PDF</Text>
        </Pressable>
      </Card>

      <Text style={styles.sectionTitle}>Attendance summary</Text>
      <Card style={styles.attGrid}>
        <AttCell label="Present" value={att.present} color={colors.present} />
        <AttCell label="Absent" value={att.absent} color={att.absent > 5 ? colors.danger : colors.text} />
        <AttCell label="Partial" value={att.partial} color={att.partial > 0 ? colors.partial : colors.text} />
        <AttCell label="Late" value={att.late} color={att.late > 0 ? colors.danger : colors.text} />
        <AttCell label="Early" value={att.early} />
        <AttCell label="WO Given" value={att.weekOffGiven} />
        <AttCell label="WO Worked" value={att.weekOffWorked} />
        <AttCell label="PL Used" value={att.plUsed} />
      </Card>
      <Text style={styles.explain}>{att.absentExplain}</Text>

      <Text style={styles.sectionTitle}>Earnings</Text>
      <Card style={{ marginBottom: spacing(2) }}>
        <Row label="Basic Salary" value={earn.basicSalary} />
        {earn.heads.map((h, i) => (
          <Row key={i} label={h.headName} value={h.amount} />
        ))}
        {earn.otEarlyAmount > 0 && <Row label={`OT Early (${earn.otEarlyMinutes} min)`} value={earn.otEarlyAmount} />}
        {earn.otLateAmount > 0 && <Row label={`OT Late (${earn.otLateMinutes} min)`} value={earn.otLateAmount} />}
        {earn.otEarlyAmount === 0 && earn.otLateAmount === 0 && earn.overtimeAmount > 0 && (
          <Row label={`Overtime (${earn.overtimeMinutes} min)`} value={earn.overtimeAmount} />
        )}
        {earn.weekOffWorkAmount > 0 && <Row label={`Week-Off Worked (${earn.weekOffWorkDays}d)`} value={earn.weekOffWorkAmount} />}
        {earn.attendanceBonusAmount > 0 && <Row label={`Attendance Bonus (${earn.attendanceBonusDays}d)`} value={earn.attendanceBonusAmount} />}
        <Row label="Gross Salary" value={earn.grossSalary} bold />
      </Card>

      <Text style={styles.sectionTitle}>Deductions</Text>
      <Card style={{ marginBottom: spacing(2) }}>
        {ded.heads.map((h, i) => (
          <Row key={i} label={h.headName} value={h.amount} />
        ))}
        {ded.absentDeductAmount > 0 && <Row label="Absent Deduction" value={ded.absentDeductAmount} />}
        {ded.halfDayDeductAmount > 0 && <Row label="Shortfall Deduction" value={ded.halfDayDeductAmount} />}
        {ded.breakDeductAmount > 0 && <Row label={`Excess Break Deduction (${ded.breakExcessMinutes}m)`} value={ded.breakDeductAmount} />}
        {ded.lateChargeDeductAmount > 0 && <Row label={`Late Coming Charge (${ded.lateDays})`} value={ded.lateChargeDeductAmount} />}
        {ded.lateMinsDeductAmount > 0 && <Row label={`Late Mins (${ded.lateMinsTotal}m)`} value={ded.lateMinsDeductAmount} />}
        {ded.earlyGoingDeductAmount > 0 && <Row label={`Early Departure (${ded.earlyGoingMinsTotal}m)`} value={ded.earlyGoingDeductAmount} />}
        {ded.advanceDeducted > 0 && <Row label="Salary Advance" value={ded.advanceDeducted} />}
        {ded.loanEMIDeduction > 0 && <Row label="Loan EMI Deduction" value={ded.loanEMIDeduction} />}
        <Row label="Total Deductions" value={ded.totalDeductions} bold />
      </Card>

      <Card style={[styles.netCard, slip.isRecovery && styles.netCardRecovery]}>
        <Text style={styles.netLabel}>{slip.isRecovery ? 'AMOUNT RECOVERABLE' : 'NET PAYABLE SALARY'}</Text>
        <Text style={styles.netValue}>Rs. {Math.abs(slip.netPayable).toFixed(2)}</Text>
        <Text style={styles.netFootnote}>
          Absent Rate: Rs. {perDayRate(earn.basicSalary, slip.payrollMonth).toFixed(2)}/day ({calendarDaysInMonth(slip.payrollMonth)} days) · Std Days: {att.workingDays}
        </Text>
      </Card>
    </ScrollView>
  );
}

function Row({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, bold && styles.bold]}>{label}</Text>
      <Text style={[styles.rowValue, bold && styles.bold]}>Rs. {value.toFixed(2)}</Text>
    </View>
  );
}

function AttCell({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <View style={styles.attCell}>
      <Text style={[styles.attValue, { color: color || colors.text }]}>{value}</Text>
      <Text style={styles.attLabel}>{label}</Text>
    </View>
  );
}

function monthName(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Calendar days in the payslip's month — mirrors DateTime.DaysInMonth used by Payslips.aspx.cs's BuildSlipHtml. */
function calendarDaysInMonth(payrollMonthStr: string) {
  const d = new Date(payrollMonthStr);
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

/** Per-day rate used for the "Absent Rate" footnote — mirrors perDayCalendar = BasicSalary / calDays. */
function perDayRate(basicSalary: number, payrollMonthStr: string) {
  const days = calendarDaysInMonth(payrollMonthStr);
  return days > 0 ? basicSalary / days : 0;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  company: { fontSize: 18, fontWeight: '800', color: colors.text },
  sub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: spacing(1), marginTop: spacing(1) },
  attGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  attCell: { width: '25%', alignItems: 'center', marginBottom: spacing(1) },
  attValue: { fontSize: 18, fontWeight: '800' },
  attLabel: { fontSize: 10, color: colors.textMuted, marginTop: 2 },
  explain: { fontSize: 12, color: colors.warning, marginBottom: spacing(2) },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowLabel: { color: colors.text, fontSize: 13, flex: 1 },
  rowValue: { color: colors.text, fontSize: 13 },
  bold: { fontWeight: '800' },
  netCard: { backgroundColor: colors.success + '15', alignItems: 'center' },
  netCardRecovery: { backgroundColor: colors.danger + '15' },
  netLabel: { fontSize: 12, color: colors.textMuted, marginBottom: 4 },
  netValue: { fontSize: 26, fontWeight: '800', color: colors.text },
  netFootnote: { fontSize: 10.5, color: colors.textMuted, marginTop: 6, textAlign: 'center' },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing(1.5),
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  downloadBtnText: { color: colors.primary, fontSize: 13, fontWeight: '700' },
});
