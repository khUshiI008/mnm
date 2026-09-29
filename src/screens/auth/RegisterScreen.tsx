import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Picker } from '../../components/AppPicker';
import Button from '../../components/Button';
import Card from '../../components/Card';
import TextField from '../../components/TextField';
import DateField from '../../components/DateField';
import { colors, spacing } from '../../theme';
import {
  getRegistrationOptions,
  startRegistration,
  verifyRegistration,
  RegistrationDepartment,
  RegistrationLocation,
  RegistrationOrganization,
} from '../../api/authApi';
import { startSmsConsentListener, extractOtp } from '../../native/smsConsent';

/**
 * Mirrors Register.aspx.cs's 3-step self-registration:
 *   Step 1 — details, uniqueness checks, SMS OTP sent
 *   Step 2 — OTP verification, creates Employee ("Trial") + EmployeeUser
 *   Step 3 — success -> back to Login
 * Field set/order matches the web Register.aspx page (Employee Full Name,
 * Attendance Code, Mobile, Email, Gender, DOB, Company, Work Location,
 * Marital Status, Department, Date of Joining, Bank Name, IFSC, Account No).
 */
export default function RegisterScreen({ navigation }: any) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);

  const [fullName, setFullName] = useState('');
  const [attendanceCode, setAttendanceCode] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [gender, setGender] = useState('');
  const [dob, setDob] = useState('');
  const [organizationId, setOrganizationId] = useState<number | null>(null);
  const [locationId, setLocationId] = useState<number | null>(null);
  const [maritalStatus, setMaritalStatus] = useState('');
  const [departmentLookupId, setDepartmentLookupId] = useState<number | null>(null);
  const [dateOfJoining, setDateOfJoining] = useState('');
  const [bankName, setBankName] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [accountNo, setAccountNo] = useState('');

  const [organizations, setOrganizations] = useState<RegistrationOrganization[]>([]);
  const [locations, setLocations] = useState<RegistrationLocation[]>([]);
  const [departments, setDepartments] = useState<RegistrationDepartment[]>([]);
  const [otp, setOtp] = useState('');

  useEffect(() => {
    getRegistrationOptions()
      .then((res) => {
        setOrganizations(res.data.organizations || []);
        setLocations(res.data.locations || []);
        setDepartments(res.data.departments || []);
        if (res.data.organizations?.length) setOrganizationId(res.data.organizations[0].OrganizationId);
      })
      .catch(() => {
        /* non-fatal — dropdowns just stay empty, user can still type codes elsewhere */
      });
  }, []);

  const submitStep1 = async () => {
    if (
      !fullName ||
      !attendanceCode ||
      mobile.length !== 10 ||
      !email ||
      !gender ||
      !dob ||
      !organizationId ||
      !locationId ||
      !maritalStatus ||
      !departmentLookupId ||
      !dateOfJoining ||
      !bankName ||
      !ifscCode ||
      !accountNo
    ) {
      Alert.alert('Missing details', 'Please fill in all fields — everything on this screen is required.');
      return;
    }
    setLoading(true);
    try {
      const res = await startRegistration({
        fullName,
        attendanceCode,
        mobile,
        email,
        gender,
        dateOfBirth: dob,
        organizationId,
        locationId,
        maritalStatus,
        departmentLookupId,
        dateOfJoining,
        bankName,
        ifscCode,
        accountNo,
      });
      Alert.alert('OTP sent', res.data.message);
      setStep(2);
    } catch (err: any) {
      Alert.alert('Could not register', err?.response?.data?.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const submitStep2 = async (otpOverride?: string) => {
    const codeToVerify = otpOverride ?? otp;
    if (!codeToVerify) return;
    setLoading(true);
    try {
      await verifyRegistration(mobile, codeToVerify);
      setStep(3);
    } catch (err: any) {
      Alert.alert('Incorrect code', err?.response?.data?.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Same SMS User Consent autofill as LoginScreen — see native/smsConsent.ts.
  useEffect(() => {
    if (step !== 2) return undefined;
    return startSmsConsentListener({
      onReceived: (message) => {
        const code = extractOtp(message, 6);
        if (code) {
          setOtp(code);
          submitStep2(code);
        }
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const selectedOrgName = organizations.find((o) => o.OrganizationId === organizationId)?.OrganizationName || '—';

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.logoBadge}>
          <Text style={styles.logoBadgeText}>MNM</Text>
        </View>
        <Text style={styles.brand}>Apna Payroll</Text>
        <Text style={styles.title}>Employee Registration</Text>
        <Text style={styles.subtitle}>Create your self-service account in three simple steps</Text>
      </View>

      <Stepper step={step} />

      {step === 1 && (
        <Card style={styles.card}>
          <TextField label="Employee Full Name" placeholder="e.g. Ravi Kumar" value={fullName} onChangeText={setFullName} />
          <TextField
            label="Attendance Code"
            placeholder="e.g. EMP-0001"
            value={attendanceCode}
            onChangeText={setAttendanceCode}
            autoCapitalize="characters"
          />
          <TextField
            label="Working Mobile Number"
            placeholder="10-digit mobile number"
            value={mobile}
            onChangeText={setMobile}
            keyboardType="number-pad"
            maxLength={10}
          />
          <TextField
            label="Working Email Address"
            placeholder="you@company.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={styles.label}>Gender</Text>
          <PickerWrap>
            <Picker selectedValue={gender} onValueChange={(v) => setGender(String(v))}>
              <Picker.Item label="-- Select Gender --" value="" />
              <Picker.Item label="Male" value="Male" />
              <Picker.Item label="Female" value="Female" />
              <Picker.Item label="Other" value="Other" />
            </Picker>
          </PickerWrap>

          <DateField label="Date of Birth" granularity="day" value={dob} onChange={setDob} placeholder="Select date" />

          <Text style={styles.label}>Company</Text>
          <View style={styles.lockedField}>
            <Text style={styles.lockedFieldText}>{selectedOrgName}</Text>
          </View>

          <Text style={styles.label}>Work Location</Text>
          <Text style={styles.hint}>select your branch / office</Text>
          <PickerWrap>
            <Picker selectedValue={locationId ?? 0} onValueChange={(v) => setLocationId(Number(v) || null)}>
              <Picker.Item label="-- Select Location --" value={0} />
              {locations
                .filter((l) => !organizationId || l.OrganizationId === organizationId)
                .map((l) => (
                  <Picker.Item key={l.LocationId} label={l.LocationName} value={l.LocationId} />
                ))}
            </Picker>
          </PickerWrap>

          <Text style={styles.label}>Marital Status</Text>
          <PickerWrap>
            <Picker selectedValue={maritalStatus} onValueChange={(v) => setMaritalStatus(String(v))}>
              <Picker.Item label="-- Select Marital Status --" value="" />
              <Picker.Item label="Single" value="Single" />
              <Picker.Item label="Married" value="Married" />
            </Picker>
          </PickerWrap>

          <Text style={styles.label}>Department</Text>
          <PickerWrap>
            <Picker selectedValue={departmentLookupId ?? 0} onValueChange={(v) => setDepartmentLookupId(Number(v) || null)}>
              <Picker.Item label="-- Select Department --" value={0} />
              {departments.map((d) => (
                <Picker.Item key={d.lookupId} label={d.name} value={d.lookupId} />
              ))}
            </Picker>
          </PickerWrap>

          <DateField label="Date of Joining" granularity="day" value={dateOfJoining} onChange={setDateOfJoining} placeholder="Select date" />

          <TextField label="Bank Name" placeholder="e.g. State Bank of India" value={bankName} onChangeText={setBankName} />
          <TextField
            label="IFSC Code"
            placeholder="e.g. SBIN0001234"
            value={ifscCode}
            onChangeText={(v) => setIfscCode(v.toUpperCase())}
            autoCapitalize="characters"
            maxLength={11}
          />
          <TextField
            label="Bank Account Number"
            placeholder="Enter your bank account number"
            value={accountNo}
            onChangeText={setAccountNo}
            keyboardType="number-pad"
          />

          <Button title="Proceed → Send OTP" onPress={submitStep1} loading={loading} style={{ marginTop: spacing(1) }} />

          <SignInLink onPress={() => navigation.replace('Login')} />
        </Card>
      )}

      {step === 2 && (
        <Card style={styles.card}>
          <Text style={styles.subtitle}>Enter the OTP sent to +91 {mobile}</Text>
          <TextField label="OTP" value={otp} onChangeText={setOtp} keyboardType="number-pad" maxLength={6} />
          <Button title="Verify & Create account" onPress={() => submitStep2()} loading={loading} />
        </Card>
      )}

      {step === 3 && (
        <Card style={styles.card}>
          <Text style={styles.success}>Registration complete!</Text>
          <Text style={styles.subtitle}>
            Your account is pending HR approval (status: Trial). You can sign in now — until approved you'll only see your
            Profile page.
          </Text>
          <Button title="Go to Sign in" onPress={() => navigation.replace('Login')} />
        </Card>
      )}
    </ScrollView>
  );
}

function Stepper({ step }: { step: 1 | 2 | 3 }) {
  const items = [
    { n: 1, label: 'Your Details' },
    { n: 2, label: 'Verify OTP' },
    { n: 3, label: 'Done' },
  ];
  return (
    <View style={styles.stepperRow}>
      {items.map((it, i) => (
        <React.Fragment key={it.n}>
          <View style={styles.stepperItem}>
            <View style={[styles.stepDot, it.n < step && styles.stepDotDone, it.n === step && styles.stepDotActive]}>
              <Text style={[styles.stepDotText, (it.n <= step) && styles.stepDotTextActive]}>{it.n < step ? '✓' : it.n}</Text>
            </View>
            <Text style={[styles.stepLabel, it.n === step && styles.stepLabelActive]}>{it.label}</Text>
          </View>
          {i < items.length - 1 && <View style={styles.stepLine} />}
        </React.Fragment>
      ))}
    </View>
  );
}

function PickerWrap({ children }: { children: React.ReactNode }) {
  return <View style={styles.pickerWrap}>{children}</View>;
}

function SignInLink({ onPress }: { onPress: () => void }) {
  return (
    <Text style={styles.foot} onPress={onPress}>
      Already have an account? <Text style={styles.link}>Sign in here</Text>
    </Text>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing(3), paddingBottom: spacing(5) },

  header: { alignItems: 'center', marginBottom: spacing(2.5) },
  logoBadge: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  logoBadgeText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  brand: { fontSize: 15, fontWeight: '800', color: colors.text, marginBottom: 6 },
  title: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 4 },
  subtitle: { color: colors.textMuted, textAlign: 'center', marginBottom: spacing(1) },
  success: { fontSize: 20, fontWeight: '700', color: colors.success, marginBottom: spacing(1) },

  stepperRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', marginBottom: spacing(2.5) },
  stepperItem: { alignItems: 'center', width: 84 },
  stepLine: { height: 2, backgroundColor: colors.border, flex: 0, width: 24, marginTop: 15 },
  stepDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  stepDotActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  stepDotDone: { borderColor: colors.primary, backgroundColor: colors.primary },
  stepDotText: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  stepDotTextActive: { color: '#fff' },
  stepLabel: { fontSize: 11, color: colors.textMuted, fontWeight: '600', textAlign: 'center' },
  stepLabelActive: { color: colors.primary },

  card: { marginBottom: spacing(3) },
  label: { fontSize: 13, color: colors.textMuted, marginBottom: 6, fontWeight: '500' },
  hint: { fontSize: 11, color: colors.textMuted, marginTop: -4, marginBottom: 6 },
  pickerWrap: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, marginBottom: spacing(2), backgroundColor: colors.surface },
  lockedField: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: colors.background,
    marginBottom: spacing(2),
  },
  lockedFieldText: { fontSize: 16, color: colors.textMuted },
  foot: { textAlign: 'center', color: colors.textMuted, marginTop: spacing(1.5), fontSize: 13 },
  link: { color: colors.primary, fontWeight: '700' },
});
