import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import Button from '../../components/Button';
import TextField from '../../components/TextField';
import Icon from '../../components/Icon';
import { colors, spacing } from '../../theme';
import { sendOtp, verifyOtp, forceLogin, resendOtp } from '../../api/authApi';
import { useAuth } from '../../context/AuthContext';
import { startSmsConsentListener, extractOtp } from '../../native/smsConsent';

const L = colors.login;

/**
 * Mirrors Login.aspx.cs's unified mobile + OTP flow: one mobile number field,
 * then an OTP field. The backend decides admin vs employee (4 allow-listed
 * admin mobiles vs. everyone else looked up against Employees/EmployeeUsers).
 * Visual design mirrors Login.aspx / Content/login.css (hero + card, light theme only).
 */
export default function LoginScreen({ navigation }: any) {
  const { signIn } = useAuth();
  const { height: windowHeight } = useWindowDimensions();
  const [step, setStep] = useState<'mobile' | 'otp'>('mobile');
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [remember, setRemember] = useState(true);
  const [alreadyLoggedIn, setAlreadyLoggedIn] = useState(false);
  const [forcing, setForcing] = useState(false);

  const heroHeight = Math.max(220, windowHeight * 0.34);

  const handleSendOtp = async () => {
    setError(null);
    if (mobile.length !== 10 || !/^[0-9]{10}$/.test(mobile)) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }
    setLoading(true);
    try {
      const res = await sendOtp(mobile);
      setInfo(res.data.message);
      setStep('otp');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (otpOverride?: string) => {
    const codeToVerify = otpOverride ?? otp;
    setError(null);
    if (!codeToVerify) return;
    setLoading(true);
    try {
      const res = await verifyOtp(mobile, codeToVerify);
      if (res.data.success && res.data.token && res.data.user) {
        await signIn(res.data.token, res.data.user);
      } else if (res.data.alreadyLoggedIn) {
        setAlreadyLoggedIn(true);
      } else {
        setError(res.data.message || 'Login failed. Please try again.');
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Incorrect OTP. Please check and try again.');
    } finally {
      setLoading(false);
    }
  };

  /** Signs the other device out and completes this login — the OTP was already verified moments ago, so it isn't re-entered here. */
  const handleForceLogin = async () => {
    setForcing(true);
    try {
      const res = await forceLogin(mobile);
      if (res.data.success && res.data.token && res.data.user) {
        setAlreadyLoggedIn(false);
        await signIn(res.data.token, res.data.user);
      } else {
        setAlreadyLoggedIn(false);
        setError(res.data.message || 'Could not sign in. Please try again.');
      }
    } catch (err: any) {
      setAlreadyLoggedIn(false);
      setError(err?.response?.data?.message || 'This request has expired. Please sign in again.');
    } finally {
      setForcing(false);
    }
  };

  const handleResend = async () => {
    setError(null);
    try {
      const res = await resendOtp(mobile);
      setInfo(res.data.message);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not resend OTP. Please try again.');
    }
  };

  const handleChangeNumber = () => {
    setError(null);
    setInfo(null);
    setOtp('');
    setStep('mobile');
  };

  // Arms Android's SMS User Consent listener the moment the OTP step opens —
  // a matching SMS triggers the OS's own "Allow [app] to read this message?"
  // prompt; only on Allow do we get the text here, extract the code, and
  // auto-submit. Deny/timeout/iOS/no Play Services all silently do nothing —
  // the OTP field is always there to fill in by hand regardless.
  useEffect(() => {
    if (step !== 'otp') return undefined;
    return startSmsConsentListener({
      onReceived: (message) => {
        const code = extractOtp(message, 6);
        if (code) {
          setOtp(code);
          handleVerify(code);
        }
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  return (
    <>
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={[styles.hero, { height: heroHeight }]}>
          <Image
            source={require('../../assets/images/login-hero.png')}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />
          <Svg style={StyleSheet.absoluteFill}>
            <Defs>
              <LinearGradient id="heroFade" x1="0%" y1="0%" x2="0%" y2="100%">
                <Stop offset="55%" stopColor={L.primary} stopOpacity={0} />
                <Stop offset="100%" stopColor={L.bg} stopOpacity={1} />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#heroFade)" />
          </Svg>
        </View>

        <View style={styles.cardWrap}>
          <View style={styles.card}>
            <Text style={styles.title}>Welcome Back!</Text>
            <Text style={styles.subtitle}>Please login to continue</Text>

            {error ? (
              <View style={[styles.alert, styles.alertDanger]}>
                <Text style={styles.alertTextDanger}>{error}</Text>
              </View>
            ) : null}

            {step === 'mobile' ? (
              <>
                <TextField
                  label="Mobile Number"
                  placeholder="Enter your mobile number"
                  keyboardType="number-pad"
                  maxLength={10}
                  value={mobile}
                  onChangeText={setMobile}
                  leftIcon={<Icon name="phone" size={18} color={L.muted} />}
                  style={styles.input}
                />

                <Pressable style={styles.rememberRow} onPress={() => setRemember(!remember)}>
                  <View style={[styles.checkbox, remember && styles.checkboxChecked]}>
                    {remember ? <Text style={styles.checkboxTick}>✓</Text> : null}
                  </View>
                  <Text style={styles.rememberLabel}>Remember me</Text>
                </Pressable>

                <Button title="Login" onPress={handleSendOtp} loading={loading} gradient={[L.primary, L.primaryDark]} />
              </>
            ) : (
              <>
                <View style={styles.otpInfoBanner}>
                  <Text style={styles.otpInfoText}>{info || `OTP sent to ${mobile}`}</Text>
                  <Pressable onPress={handleChangeNumber}>
                    <Text style={styles.otpChangeBtn}>Change number</Text>
                  </Pressable>
                </View>

                <TextField
                  label="One-Time Password"
                  placeholder="••••••"
                  keyboardType="number-pad"
                  maxLength={6}
                  value={otp}
                  onChangeText={setOtp}
                  secureTextEntry
                  leftIcon={<Icon name="lock" size={18} color={L.muted} />}
                  style={[styles.input, styles.otpInput]}
                />

                <View style={styles.resendRow}>
                  <Text style={styles.resendHint}>OTP valid for 10 minutes.</Text>
                  <Pressable onPress={handleResend}>
                    <Text style={styles.resendLink}>Resend OTP</Text>
                  </Pressable>
                </View>

                <View style={{ height: spacing(1.5) }} />
                <Button
                  title="Verify & Sign In →"
                  onPress={() => handleVerify()}
                  loading={loading}
                  gradient={[L.primary, L.primaryDark]}
                />
              </>
            )}

            <Text style={styles.link} onPress={() => navigation.navigate('Register')}>
              Apna Account Banao!
            </Text>

            <View style={styles.legalRow}>
              <Text style={styles.legalLink}>Terms &amp; Conditions</Text>
              <Text style={styles.legalSep}>|</Text>
              <Text style={styles.legalLink}>Privacy Policy</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>

    <Modal visible={alreadyLoggedIn} transparent animationType="fade" onRequestClose={() => setAlreadyLoggedIn(false)}>
      <View style={styles.alertBackdrop}>
        <View style={styles.alertCard}>
          <View style={styles.alertIconWrap}>
            <Icon name="alertCircle" size={56} color="#fff" strokeWidth={2.5} />
          </View>
          <Text style={styles.alertTitle}>ATTENTION!</Text>
          <Text style={styles.alertSubtitle}>Already Logged In Elsewhere</Text>

          <View style={styles.alertInfoBox}>
            <Text style={styles.alertInfoText}>
              Your account is already signed in on another device.
            </Text>
          </View>

          <Text style={styles.alertBody}>
            Sign out there first, or sign that device out remotely below to continue here.
          </Text>

          <Pressable style={styles.alertPrimaryBtn} onPress={handleForceLogin} disabled={forcing}>
            {forcing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.alertPrimaryBtnText}>⚠ Logout Other Device &amp; Continue</Text>
            )}
          </Pressable>
          <Pressable style={styles.alertCancelBtn} onPress={() => setAlreadyLoggedIn(false)} disabled={forcing}>
            <Text style={styles.alertCancelBtnText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: L.bg },
  scrollContent: { flexGrow: 1 },
  hero: { width: '100%', backgroundColor: L.primary, overflow: 'hidden' },
  cardWrap: { marginTop: -48, paddingHorizontal: 20, paddingBottom: 40 },
  card: {
    backgroundColor: L.surface,
    borderRadius: 28,
    padding: 28,
    shadowColor: L.primary,
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.25,
    shadowRadius: 30,
    elevation: 10,
  },
  title: { fontSize: 24, fontWeight: '800', color: L.ink, marginBottom: 6 },
  subtitle: { fontSize: 14, color: L.muted, marginBottom: 24 },

  alert: { borderRadius: 10, padding: 12, marginBottom: 16 },
  alertDanger: { backgroundColor: L.dangerBg, borderWidth: 1, borderColor: L.dangerBorder },
  alertTextDanger: { color: L.danger, fontSize: 13, fontWeight: '600' },

  input: { height: 48, borderRadius: 10, backgroundColor: L.inputBg, borderColor: L.border, fontSize: 14 },
  otpInput: { fontSize: 22, letterSpacing: 10, textAlign: 'center', fontWeight: '700', paddingLeft: 14 },

  rememberRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: L.border,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: L.primary, borderColor: L.primary },
  checkboxTick: { color: '#fff', fontSize: 12, fontWeight: '700' },
  rememberLabel: { fontSize: 13, color: L.ink },

  otpInfoBanner: {
    backgroundColor: L.infoBg,
    borderWidth: 1,
    borderColor: L.infoBorder,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  otpInfoText: { flex: 1, fontSize: 13, color: L.info },
  otpChangeBtn: { color: L.primary, fontSize: 12, fontWeight: '600' },

  resendRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  resendHint: { fontSize: 12.5, color: L.muted },
  resendLink: { fontSize: 12.5, fontWeight: '600', color: L.primary },

  link: { textAlign: 'center', color: L.primary, marginTop: 22, fontWeight: '600', fontSize: 13 },
  legalRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 16 },
  legalLink: { fontSize: 12, color: L.muted },
  legalSep: { fontSize: 12, color: L.border, marginHorizontal: 8 },

  alertBackdrop: { flex: 1, backgroundColor: 'rgba(15,13,35,0.55)', alignItems: 'center', justifyContent: 'center', padding: 28 },
  alertCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#fff',
    borderRadius: 24,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
  },
  alertIconWrap: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: L.danger,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  alertTitle: { fontSize: 22, fontWeight: '800', color: L.danger, letterSpacing: 0.5 },
  alertSubtitle: { fontSize: 15, fontWeight: '700', color: L.ink, marginTop: 4, marginBottom: 18, textAlign: 'center' },
  alertInfoBox: { width: '100%', backgroundColor: L.dangerBg, borderWidth: 1, borderColor: L.dangerBorder, borderRadius: 12, padding: 14, marginBottom: 14 },
  alertInfoText: { fontSize: 13.5, fontWeight: '600', color: L.danger, textAlign: 'center' },
  alertBody: { fontSize: 12.5, color: L.muted, textAlign: 'center', lineHeight: 18, marginBottom: 22 },
  alertPrimaryBtn: { width: '100%', height: 50, borderRadius: 12, backgroundColor: L.danger, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  alertPrimaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  alertCancelBtn: { width: '100%', height: 44, alignItems: 'center', justifyContent: 'center' },
  alertCancelBtnText: { color: L.muted, fontWeight: '600', fontSize: 13 },
});
